import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { Prisma } from "@prisma/client";
import sharp from "sharp";

import {
	type AssetStorage,
	getAssetDirectoryPrefix,
	getAssetStorage,
} from "./asset-storage.server.ts";
import { getConfig } from "./config.service.server.ts";
import { getDb } from "./db.server.ts";
import {
	getGroupMembership,
	resolveGroupRole,
} from "./group-membership.service.server.ts";
import { logError, logInfo, logWarn } from "./logger.server.ts";
import { recordMediaMetric } from "./metrics.server.ts";
import {
	cleanupParsedMultipartForm,
	type ParsedMultipartFile,
} from "./multipart-form.server.ts";
import {
	canViewGroup,
	canViewInstanceFeed,
	type GroupVisibilityMode,
	getInstanceViewerRole,
	type ViewerRole,
} from "./permissions.server.ts";
import { getAuthUserFromRequest } from "./session.server.ts";
import { getSetupStatus } from "./setup.service.server.ts";

export const MAX_IMAGES_PER_POST = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 60;
export const MAX_ALBUM_TAGS_PER_ASSET = 8;
export const MAX_ALBUM_TAG_LENGTH = 48;

const IMAGE_MIME_TYPES = new Set([
	"image/avif",
	"image/jpeg",
	"image/png",
	"image/webp",
]);

const VIDEO_MIME_TYPES = new Set([
	"video/mp4",
	"video/quicktime",
	"video/webm",
]);

const IMAGE_VARIANT_SPECS = [
	{ key: "image-large", width: 1600, height: 1600, fit: "inside" as const },
	{ key: "image-small", width: 800, height: 800, fit: "inside" as const },
	{ key: "image-thumbnail", width: 320, height: 320, fit: "cover" as const },
];

type AssetKind = "image" | "video";
type AssetProcessingStatus = "pending" | "ready" | "failed";

export type PostAssetSummary = {
	id: string;
	kind: AssetKind;
	processingStatus: AssetProcessingStatus;
	alt?: string;
	albumTags: string[];
	width?: number;
	height?: number;
	durationSeconds?: number;
	variants: {
		large?: string;
		small?: string;
		thumbnail?: string;
		playback?: string;
		poster?: string;
	};
};

type PreparedDbAsset = {
	id: string;
	postId: string;
	instanceId: string;
	kind: AssetKind;
	processingStatus: AssetProcessingStatus;
	originalFilename: string | null;
	sourceMimeType: string | null;
	sourceByteSize: number | null;
	albumTags: string[];
	width: number | null;
	height: number | null;
	durationSeconds: number | null;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
};

type PreparedDbVariant = {
	id: string;
	assetId: string;
	variantKey: string;
	format: string;
	mimeType: string;
	storageKey: string;
	byteSize: number;
	width: number | null;
	height: number | null;
	durationSeconds: number | null;
	createdAt: Date;
};

type PreparedPostAssetPersistence = {
	persist(trx: Prisma.TransactionClient): Promise<void>;
	cleanup(): Promise<void>;
};

type ProbedVideo = {
	durationSeconds: number;
	width: number;
	height: number;
};

function buildVariantUrl(assetId: string, variantKey: string): string {
	return `/media/${assetId}/${variantKey}`;
}

function inferExtensionFromMimeType(mimeType: string): string {
	switch (mimeType) {
		case "image/jpeg":
			return ".jpg";
		case "image/png":
			return ".png";
		case "image/webp":
			return ".webp";
		case "image/avif":
			return ".avif";
		case "video/mp4":
			return ".mp4";
		case "video/quicktime":
			return ".mov";
		case "video/webm":
			return ".webm";
		default:
			return ".bin";
	}
}

function trimFilename(filename: string): string {
	return (
		filename
			.trim()
			.replace(/[^\w.-]+/g, "-")
			.slice(0, 120) || "upload"
	);
}

function stripFilenameExtension(filename: string): string {
	return filename.replace(/\.[^.]+$/, "");
}

function toProcessingStatus(value: string): AssetProcessingStatus {
	return value === "ready" || value === "failed" ? value : "pending";
}

function toAssetKind(value: string): AssetKind {
	return value === "video" ? "video" : "image";
}

export function parseAlbumTagsInput(
	value: string | null | undefined,
): string[] {
	const parsed = (value ?? "")
		.split(/[\n,]+/)
		.map((albumTag) => albumTag.trim().replace(/\s+/g, " "))
		.filter(Boolean);

	if (parsed.length === 0) {
		return [];
	}

	const deduped: string[] = [];
	const seen = new Set<string>();
	for (const albumTag of parsed) {
		if (albumTag.length > MAX_ALBUM_TAG_LENGTH) {
			throw new Error(
				`Album names must be ${MAX_ALBUM_TAG_LENGTH} characters or shorter`,
			);
		}

		const normalizedKey = albumTag.toLowerCase();
		if (seen.has(normalizedKey)) {
			continue;
		}

		seen.add(normalizedKey);
		deduped.push(albumTag);
	}

	if (deduped.length > MAX_ALBUM_TAGS_PER_ASSET) {
		throw new Error(
			`Images can be tagged into at most ${MAX_ALBUM_TAGS_PER_ASSET} albums`,
		);
	}

	return deduped;
}

async function runCommand(command: string, args: string[]): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stderr = "";

		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(
				new Error(`${command} exited with code ${code}: ${stderr.trim()}`),
			);
		});
	});
}

async function runCommandJson<T>(command: string, args: string[]): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code !== 0) {
				reject(
					new Error(`${command} exited with code ${code}: ${stderr.trim()}`),
				);
				return;
			}

			try {
				resolve(JSON.parse(stdout) as T);
			} catch (error) {
				reject(error);
			}
		});
	});
}

async function writeFileToStorage(params: {
	storage: AssetStorage;
	key: string;
	filePath: string;
}): Promise<number> {
	const result = await params.storage.writeStream({
		key: params.key,
		stream: createReadStream(params.filePath),
	});
	return result.byteSize;
}

async function probeVideo(filePath: string): Promise<ProbedVideo> {
	const result = await runCommandJson<{
		streams?: Array<{
			codec_type?: string;
			width?: number;
			height?: number;
			duration?: string;
		}>;
		format?: { duration?: string };
	}>("ffprobe", [
		"-v",
		"error",
		"-show_streams",
		"-show_format",
		"-print_format",
		"json",
		filePath,
	]);

	const videoStream = result.streams?.find(
		(stream) => stream.codec_type === "video",
	);
	if (!videoStream?.width || !videoStream.height) {
		throw new Error("Uploaded video does not contain a readable video stream");
	}

	const durationSeconds = Number(
		videoStream.duration ?? result.format?.duration ?? 0,
	);
	if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
		throw new Error("Uploaded video duration could not be determined");
	}

	return {
		durationSeconds,
		width: videoStream.width,
		height: videoStream.height,
	};
}

async function createImageVariants(params: {
	storage: AssetStorage;
	assetId: string;
	upload: ParsedMultipartFile;
	albumTags: string[];
	sortOrder: number;
	postId: string;
	instanceId: string;
}): Promise<{
	asset: PreparedDbAsset;
	variants: PreparedDbVariant[];
}> {
	const assetId = params.assetId;
	const prefix = getAssetDirectoryPrefix({ assetId });
	const now = new Date();
	const image = sharp(params.upload.tempFilePath, { failOn: "error" }).rotate();
	const metadata = await image.metadata();
	if (!metadata.width || !metadata.height) {
		throw new Error(
			`Could not read image dimensions for ${params.upload.filename}`,
		);
	}

	const originalFilename = trimFilename(params.upload.filename);
	const originalKey = `${prefix}/original/source${inferExtensionFromMimeType(params.upload.mimeType)}`;
	await writeFileToStorage({
		storage: params.storage,
		key: originalKey,
		filePath: params.upload.tempFilePath,
	});

	const variants: PreparedDbVariant[] = [];

	for (const spec of IMAGE_VARIANT_SPECS) {
		const basePipeline = sharp(params.upload.tempFilePath)
			.rotate()
			.resize({
				width: spec.width,
				height: spec.height,
				fit: spec.fit,
				withoutEnlargement: true,
				position: spec.fit === "cover" ? "centre" : undefined,
			});

		const avifBuffer = await basePipeline
			.clone()
			.avif({ quality: 60 })
			.toBuffer();
		const avifMeta = await sharp(avifBuffer).metadata();
		const avifKey = `${prefix}/${spec.key}.avif`;
		await params.storage.writeBuffer({ key: avifKey, buffer: avifBuffer });
		variants.push({
			id: randomUUID(),
			assetId,
			variantKey: spec.key,
			format: "avif",
			mimeType: "image/avif",
			storageKey: avifKey,
			byteSize: avifBuffer.byteLength,
			width: avifMeta.width ?? null,
			height: avifMeta.height ?? null,
			durationSeconds: null,
			createdAt: now,
		});

		const jpegBuffer = await basePipeline
			.clone()
			.jpeg({ quality: 82, mozjpeg: true })
			.toBuffer();
		const jpegMeta = await sharp(jpegBuffer).metadata();
		const jpegKey = `${prefix}/${spec.key}.jpeg`;
		await params.storage.writeBuffer({ key: jpegKey, buffer: jpegBuffer });
		variants.push({
			id: randomUUID(),
			assetId,
			variantKey: spec.key,
			format: "jpeg",
			mimeType: "image/jpeg",
			storageKey: jpegKey,
			byteSize: jpegBuffer.byteLength,
			width: jpegMeta.width ?? null,
			height: jpegMeta.height ?? null,
			durationSeconds: null,
			createdAt: now,
		});
	}

	return {
		asset: {
			id: assetId,
			postId: params.postId,
			instanceId: params.instanceId,
			kind: "image",
			processingStatus: "ready",
			originalFilename,
			sourceMimeType: params.upload.mimeType,
			sourceByteSize: params.upload.byteSize,
			albumTags: params.albumTags,
			width: metadata.width,
			height: metadata.height,
			durationSeconds: null,
			sortOrder: params.sortOrder,
			createdAt: now,
			updatedAt: now,
		},
		variants,
	};
}

async function stageVideoAsset(params: {
	storage: AssetStorage;
	postId: string;
	instanceId: string;
	assetId: string;
	upload: ParsedMultipartFile;
	sortOrder: number;
}): Promise<{
	asset: PreparedDbAsset;
	job: {
		id: string;
		instanceId: string;
		postId: string;
		jobType: string;
		status: string;
		payload: Prisma.InputJsonValue;
		attempts: number;
		maxAttempts: number;
		lastError: string | null;
		createdAt: Date;
		updatedAt: Date;
	};
}> {
	const prefix = getAssetDirectoryPrefix({ assetId: params.assetId });
	const sourceStorageKey = `${prefix}/upload/source${inferExtensionFromMimeType(params.upload.mimeType)}`;
	const originalFilename = trimFilename(params.upload.filename);
	const now = new Date();
	const probed = await probeVideo(params.upload.tempFilePath);
	if (params.upload.byteSize > MAX_VIDEO_BYTES) {
		throw new Error(`Video ${originalFilename} exceeds the 100 MB limit`);
	}
	if (probed.durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
		throw new Error(`Video ${originalFilename} exceeds the 60 second limit`);
	}

	await writeFileToStorage({
		storage: params.storage,
		key: sourceStorageKey,
		filePath: params.upload.tempFilePath,
	});

	return {
		asset: {
			id: params.assetId,
			postId: params.postId,
			instanceId: params.instanceId,
			kind: "video",
			processingStatus: "pending",
			originalFilename,
			sourceMimeType: params.upload.mimeType,
			sourceByteSize: params.upload.byteSize,
			albumTags: [],
			width: probed.width,
			height: probed.height,
			durationSeconds: probed.durationSeconds,
			sortOrder: params.sortOrder,
			createdAt: now,
			updatedAt: now,
		},
		job: {
			id: randomUUID(),
			instanceId: params.instanceId,
			postId: params.postId,
			jobType: "video_transcode",
			status: "pending",
			payload: {
				assetId: params.assetId,
				sourceStorageKey,
				sourceMimeType: params.upload.mimeType,
				originalFilename,
			},
			attempts: 0,
			maxAttempts: 5,
			lastError: null,
			createdAt: now,
			updatedAt: now,
		},
	};
}

function assertAcceptedMimeType(upload: ParsedMultipartFile): AssetKind {
	if (IMAGE_MIME_TYPES.has(upload.mimeType)) {
		return "image";
	}
	if (VIDEO_MIME_TYPES.has(upload.mimeType)) {
		return "video";
	}
	throw new Error(
		`Unsupported asset type: ${upload.mimeType || upload.filename}`,
	);
}

export async function preparePostAssetsForCreate(params: {
	instanceId: string;
	postId: string;
	uploads: ParsedMultipartFile[];
	albumTags?: string[];
}): Promise<PreparedPostAssetPersistence> {
	if (params.uploads.length === 0) {
		return {
			async persist() {},
			async cleanup() {},
		};
	}

	const storage = await getAssetStorage();
	const assetPrefixes = new Set<string>();
	const albumTags = params.albumTags ?? [];
	const uploadsWithKind = params.uploads.map((upload, sortOrder) => ({
		upload,
		sortOrder,
		kind: assertAcceptedMimeType(upload),
	}));
	const kinds = new Set(uploadsWithKind.map((item) => item.kind));
	if (kinds.size > 1) {
		throw new Error("Posts can include either images or one video, not both");
	}

	const firstKind = uploadsWithKind[0]?.kind;
	if (firstKind === "image") {
		if (uploadsWithKind.length > MAX_IMAGES_PER_POST) {
			throw new Error(
				`Posts can include at most ${MAX_IMAGES_PER_POST} images`,
			);
		}
		for (const item of uploadsWithKind) {
			if (item.upload.byteSize > MAX_IMAGE_BYTES) {
				throw new Error(
					`Image ${item.upload.filename} exceeds the 10 MB limit`,
				);
			}
		}
	}

	if (firstKind === "video" && uploadsWithKind.length !== 1) {
		throw new Error("Posts can include only one video");
	}

	if (firstKind === "video" && albumTags.length > 0) {
		throw new Error("Albums can only be assigned to image uploads");
	}

	const preparedAssets: PreparedDbAsset[] = [];
	const preparedVariants: PreparedDbVariant[] = [];
	const preparedJobs: Array<{
		id: string;
		instanceId: string;
		postId: string;
		jobType: string;
		status: string;
		payload: Prisma.InputJsonValue;
		attempts: number;
		maxAttempts: number;
		lastError: string | null;
		createdAt: Date;
		updatedAt: Date;
	}> = [];

	try {
		if (firstKind === "image") {
			for (const item of uploadsWithKind) {
				const assetId = randomUUID();
				assetPrefixes.add(getAssetDirectoryPrefix({ assetId }));
				const prepared = await createImageVariants({
					storage,
					assetId,
					upload: item.upload,
					albumTags,
					sortOrder: item.sortOrder,
					postId: params.postId,
					instanceId: params.instanceId,
				});
				preparedAssets.push(prepared.asset);
				preparedVariants.push(...prepared.variants);
				recordMediaMetric({ event: "upload", outcome: "accepted" });
				logInfo({
					event: "media.upload.image_processed",
					data: {
						assetId,
						postId: params.postId,
						filename: item.upload.filename,
					},
				});
			}
		} else if (firstKind === "video") {
			const item = uploadsWithKind[0];
			if (!item) {
				throw new Error("No video upload found");
			}
			const assetId = randomUUID();
			assetPrefixes.add(getAssetDirectoryPrefix({ assetId }));
			const prepared = await stageVideoAsset({
				storage,
				postId: params.postId,
				instanceId: params.instanceId,
				assetId,
				upload: item.upload,
				sortOrder: item.sortOrder,
			});
			preparedAssets.push(prepared.asset);
			preparedJobs.push(prepared.job);
			recordMediaMetric({ event: "upload", outcome: "accepted" });
			logInfo({
				event: "media.upload.video_queued",
				data: {
					assetId,
					postId: params.postId,
					filename: item.upload.filename,
				},
			});
		}

		return {
			async persist(trx) {
				for (const asset of preparedAssets) {
					await trx.postAsset.create({ data: asset });
				}
				if (preparedVariants.length > 0) {
					await trx.postAssetVariant.createMany({ data: preparedVariants });
				}
				for (const job of preparedJobs) {
					await trx.processingJob.create({ data: job });
				}
			},
			async cleanup() {
				await Promise.all(
					[...assetPrefixes].map((prefix) => storage.deletePrefix({ prefix })),
				);
			},
		};
	} catch (error) {
		recordMediaMetric({ event: "upload", outcome: "rejected" });
		logWarn({
			event: "media.upload.rejected",
			data: {
				postId: params.postId,
				error: error instanceof Error ? error.message : "unknown error",
			},
		});
		await Promise.all(
			[...assetPrefixes].map((prefix) => storage.deletePrefix({ prefix })),
		);
		throw error;
	}
}

function pickImageVariantFormat(
	acceptHeader: string,
	variants: Array<{ format: string }>,
): string | null {
	const acceptsAvif =
		acceptHeader.includes("image/avif") || acceptHeader.includes("*/*");
	if (acceptsAvif && variants.some((variant) => variant.format === "avif")) {
		return "avif";
	}
	if (variants.some((variant) => variant.format === "jpeg")) {
		return "jpeg";
	}
	return variants[0]?.format ?? null;
}

async function resolveAssetAccess(params: {
	request: Request;
	post: {
		id: string;
		instanceId: string;
		groupId: string | null;
		moderationStatus: string;
		hiddenAt: Date | null;
		deletedAt: Date | null;
	};
}): Promise<{ allowed: boolean; isPublic: boolean }> {
	const authUser = await getAuthUserFromRequest({ request: params.request });
	const setup = await getSetupStatus();
	if (authUser && setup.isSetup && setup.instance) {
		const { ensureInstanceMembershipForUser } = await import(
			"./community.service.server.ts"
		);
		const user = {
			id: authUser.id,
			hubUserId: authUser.hubUserId,
			role: "member",
		} as const;
		await ensureInstanceMembershipForUser({
			instanceId: params.post.instanceId,
			approvalMode: setup.instance.approvalMode,
			user,
		});
	}

	const viewerRole: ViewerRole = authUser
		? await getInstanceViewerRole({
				instanceId: params.post.instanceId,
				userId: authUser.id,
			})
		: "guest";
	const isAdmin = viewerRole === "admin";
	if (
		!isAdmin &&
		(Boolean(params.post.hiddenAt) ||
			Boolean(params.post.deletedAt) ||
			params.post.moderationStatus === "rejected")
	) {
		return { allowed: false, isPublic: false };
	}

	if (!params.post.groupId) {
		const visibilityMode = await getConfig("server_visibility_mode");
		const result = canViewInstanceFeed({
			visibilityMode,
			viewerRole,
			isAuthenticated: Boolean(authUser),
		});
		return {
			allowed: result.allowed,
			isPublic: visibilityMode === "public",
		};
	}

	const group = await getDb().communityGroup.findUnique({
		where: { id: params.post.groupId },
		select: { visibilityMode: true },
	});
	if (!group) {
		return { allowed: false, isPublic: false };
	}

	const groupVisibilityMode = group.visibilityMode as GroupVisibilityMode;
	const membership = authUser
		? await getGroupMembership({
				groupId: params.post.groupId,
				userId: authUser.id,
			})
		: null;
	const groupRole = resolveGroupRole(membership);
	const result = canViewGroup({
		isAuthenticated: Boolean(authUser),
		instanceViewerRole: viewerRole,
		groupRole,
		visibilityMode: groupVisibilityMode,
	});
	return {
		allowed: result.allowed,
		isPublic: groupVisibilityMode === "public",
	};
}

export async function createMediaResponse(params: {
	request: Request;
	assetId: string;
	variantKey: string;
}): Promise<Response> {
	const asset = await getDb().postAsset.findUnique({
		where: { id: params.assetId },
		include: {
			post: {
				select: {
					id: true,
					instanceId: true,
					groupId: true,
					moderationStatus: true,
					hiddenAt: true,
					deletedAt: true,
				},
			},
			variants: {
				where: { variantKey: params.variantKey },
				orderBy: [{ format: "asc" }],
			},
		},
	});

	if (
		!asset ||
		asset.processingStatus !== "ready" ||
		asset.variants.length === 0
	) {
		return new Response("Not found", { status: 404 });
	}

	const access = await resolveAssetAccess({
		request: params.request,
		post: asset.post,
	});
	if (!access.allowed) {
		return new Response("Not found", { status: 404 });
	}

	const acceptHeader = params.request.headers.get("accept") ?? "*/*";
	const preferredFormat =
		params.variantKey === "video-playback"
			? "mp4"
			: pickImageVariantFormat(acceptHeader, asset.variants);
	const variant =
		asset.variants.find((item) => item.format === preferredFormat) ??
		asset.variants[0];
	if (!variant) {
		return new Response("Not found", { status: 404 });
	}

	const storage = await getAssetStorage();
	const byteSize = await storage.statObject({ key: variant.storageKey });
	if (!byteSize) {
		return new Response("Not found", { status: 404 });
	}
	const body = Readable.toWeb(
		await storage.createReadStream({ key: variant.storageKey }),
	) as ReadableStream;

	return new Response(body, {
		status: 200,
		headers: {
			"Cache-Control": access.isPublic
				? "public, max-age=3600"
				: "private, no-store",
			"Content-Length": String(byteSize.byteSize),
			"Content-Type": variant.mimeType,
			Vary: "Accept, Cookie",
			"X-Content-Type-Options": "nosniff",
		},
	});
}

export async function loadPostAssetSummaries(params: {
	postIds: string[];
}): Promise<Map<string, PostAssetSummary[]>> {
	if (params.postIds.length === 0) {
		return new Map();
	}

	const assets = await getDb().postAsset.findMany({
		where: {
			postId: { in: params.postIds },
		},
		include: {
			variants: {
				orderBy: [{ variantKey: "asc" }, { format: "asc" }],
			},
		},
		orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
	});

	const byPostId = new Map<string, PostAssetSummary[]>();
	for (const asset of assets) {
		const summary: PostAssetSummary = {
			id: asset.id,
			kind: toAssetKind(asset.kind),
			processingStatus: toProcessingStatus(asset.processingStatus),
			alt: asset.originalFilename
				? stripFilenameExtension(asset.originalFilename)
				: undefined,
			albumTags: asset.albumTags,
			width: asset.width ?? undefined,
			height: asset.height ?? undefined,
			durationSeconds: asset.durationSeconds ?? undefined,
			variants: {},
		};

		if (
			asset.variants.some((variant) => variant.variantKey === "image-large")
		) {
			summary.variants.large = buildVariantUrl(asset.id, "image-large");
		}
		if (
			asset.variants.some((variant) => variant.variantKey === "image-small")
		) {
			summary.variants.small = buildVariantUrl(asset.id, "image-small");
		}
		if (
			asset.variants.some((variant) => variant.variantKey === "image-thumbnail")
		) {
			summary.variants.thumbnail = buildVariantUrl(asset.id, "image-thumbnail");
		}
		if (
			asset.variants.some((variant) => variant.variantKey === "video-playback")
		) {
			summary.variants.playback = buildVariantUrl(asset.id, "video-playback");
		}
		if (
			asset.variants.some((variant) => variant.variantKey === "video-poster")
		) {
			summary.variants.poster = buildVariantUrl(asset.id, "video-poster");
		}
		if (
			!summary.variants.thumbnail &&
			asset.variants.some((variant) => variant.variantKey === "video-thumbnail")
		) {
			summary.variants.thumbnail = buildVariantUrl(asset.id, "video-thumbnail");
		}

		const current = byPostId.get(asset.postId) ?? [];
		current.push(summary);
		byPostId.set(asset.postId, current);
	}

	return byPostId;
}

export async function loadUserAlbumTags(params: {
	instanceId: string;
	userId: string;
	hubUserId?: string;
}): Promise<string[]> {
	const authorIds = [
		...new Set([params.userId, params.hubUserId].filter(Boolean)),
	];
	if (authorIds.length === 0) {
		return [];
	}

	const rows = await getDb().$queryRaw<Array<{ tag: string }>>(Prisma.sql`
		SELECT album_tag AS tag
		FROM "post_asset" pa
		INNER JOIN "post" p ON p.id = pa.post_id
		CROSS JOIN LATERAL unnest(pa.album_tags) AS album_tag
		WHERE pa.instance_id = ${params.instanceId}
			AND pa.kind = 'image'
			AND p.author_id IN (${Prisma.join(authorIds)})
		GROUP BY album_tag
		ORDER BY MAX(pa.created_at) DESC, album_tag ASC
		LIMIT 24
	`);

	return rows.map((row) => row.tag);
}

async function writeGeneratedFile(params: {
	storage: AssetStorage;
	filePath: string;
	storageKey: string;
}): Promise<number> {
	return writeFileToStorage({
		storage: params.storage,
		key: params.storageKey,
		filePath: params.filePath,
	});
}

async function createVideoPosterVariants(params: {
	storage: AssetStorage;
	posterPath: string;
	assetId: string;
}): Promise<PreparedDbVariant[]> {
	const prefix = getAssetDirectoryPrefix({ assetId: params.assetId });
	const now = new Date();
	const poster = sharp(params.posterPath).rotate();

	const posterLarge = poster.clone().resize({
		width: 1280,
		height: 720,
		fit: "inside",
		withoutEnlargement: true,
	});
	const posterAvif = await posterLarge.clone().avif({ quality: 60 }).toBuffer();
	const posterAvifMeta = await sharp(posterAvif).metadata();
	const posterAvifKey = `${prefix}/video-poster.avif`;
	await params.storage.writeBuffer({ key: posterAvifKey, buffer: posterAvif });

	const posterJpeg = await posterLarge
		.clone()
		.jpeg({ quality: 82, mozjpeg: true })
		.toBuffer();
	const posterJpegMeta = await sharp(posterJpeg).metadata();
	const posterJpegKey = `${prefix}/video-poster.jpeg`;
	await params.storage.writeBuffer({ key: posterJpegKey, buffer: posterJpeg });

	const thumb = poster.clone().resize({
		width: 320,
		height: 320,
		fit: "cover",
		position: "centre",
	});
	const thumbAvif = await thumb.clone().avif({ quality: 60 }).toBuffer();
	const thumbAvifMeta = await sharp(thumbAvif).metadata();
	const thumbAvifKey = `${prefix}/video-thumbnail.avif`;
	await params.storage.writeBuffer({ key: thumbAvifKey, buffer: thumbAvif });

	const thumbJpeg = await thumb
		.clone()
		.jpeg({ quality: 82, mozjpeg: true })
		.toBuffer();
	const thumbJpegMeta = await sharp(thumbJpeg).metadata();
	const thumbJpegKey = `${prefix}/video-thumbnail.jpeg`;
	await params.storage.writeBuffer({ key: thumbJpegKey, buffer: thumbJpeg });

	return [
		{
			id: randomUUID(),
			assetId: params.assetId,
			variantKey: "video-poster",
			format: "avif",
			mimeType: "image/avif",
			storageKey: posterAvifKey,
			byteSize: posterAvif.byteLength,
			width: posterAvifMeta.width ?? null,
			height: posterAvifMeta.height ?? null,
			durationSeconds: null,
			createdAt: now,
		},
		{
			id: randomUUID(),
			assetId: params.assetId,
			variantKey: "video-poster",
			format: "jpeg",
			mimeType: "image/jpeg",
			storageKey: posterJpegKey,
			byteSize: posterJpeg.byteLength,
			width: posterJpegMeta.width ?? null,
			height: posterJpegMeta.height ?? null,
			durationSeconds: null,
			createdAt: now,
		},
		{
			id: randomUUID(),
			assetId: params.assetId,
			variantKey: "video-thumbnail",
			format: "avif",
			mimeType: "image/avif",
			storageKey: thumbAvifKey,
			byteSize: thumbAvif.byteLength,
			width: thumbAvifMeta.width ?? null,
			height: thumbAvifMeta.height ?? null,
			durationSeconds: null,
			createdAt: now,
		},
		{
			id: randomUUID(),
			assetId: params.assetId,
			variantKey: "video-thumbnail",
			format: "jpeg",
			mimeType: "image/jpeg",
			storageKey: thumbJpegKey,
			byteSize: thumbJpeg.byteLength,
			width: thumbJpegMeta.width ?? null,
			height: thumbJpegMeta.height ?? null,
			durationSeconds: null,
			createdAt: now,
		},
	];
}

async function processVideoJob(params: {
	jobId: string;
	assetId: string;
	sourceStorageKey: string;
}): Promise<void> {
	const storage = await getAssetStorage();
	const sourcePath = await storage.resolvePath({
		key: params.sourceStorageKey,
	});
	const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengather-video-"));
	const playbackPath = path.join(tempDir, "playback.mp4");
	const posterPath = path.join(tempDir, "poster.png");

	try {
		await runCommand("ffmpeg", [
			"-y",
			"-i",
			sourcePath,
			"-map",
			"0:v:0",
			"-map",
			"0:a?",
			"-t",
			String(MAX_VIDEO_DURATION_SECONDS),
			"-vf",
			"scale=1280:720:force_original_aspect_ratio=decrease",
			"-c:v",
			"libx264",
			"-preset",
			"veryfast",
			"-crf",
			"28",
			"-pix_fmt",
			"yuv420p",
			"-c:a",
			"aac",
			"-movflags",
			"+faststart",
			playbackPath,
		]);
		await runCommand("ffmpeg", [
			"-y",
			"-ss",
			"0.5",
			"-i",
			sourcePath,
			"-frames:v",
			"1",
			posterPath,
		]);

		const prefix = getAssetDirectoryPrefix({ assetId: params.assetId });
		const playbackKey = `${prefix}/video-playback.mp4`;
		const byteSize = await writeGeneratedFile({
			storage,
			filePath: playbackPath,
			storageKey: playbackKey,
		});
		const playbackMeta = await probeVideo(playbackPath);
		const variants = await createVideoPosterVariants({
			storage,
			posterPath,
			assetId: params.assetId,
		});
		variants.unshift({
			id: randomUUID(),
			assetId: params.assetId,
			variantKey: "video-playback",
			format: "mp4",
			mimeType: "video/mp4",
			storageKey: playbackKey,
			byteSize,
			width: playbackMeta.width,
			height: playbackMeta.height,
			durationSeconds: playbackMeta.durationSeconds,
			createdAt: new Date(),
		});

		await getDb().$transaction(async (trx) => {
			await trx.postAssetVariant.deleteMany({
				where: { assetId: params.assetId },
			});
			await trx.postAssetVariant.createMany({ data: variants });
			await trx.postAsset.update({
				where: { id: params.assetId },
				data: {
					processingStatus: "ready",
					width: playbackMeta.width,
					height: playbackMeta.height,
					durationSeconds: playbackMeta.durationSeconds,
					updatedAt: new Date(),
				},
			});
			await trx.processingJob.update({
				where: { id: params.jobId },
				data: {
					status: "completed",
					attempts: { increment: 1 },
					lastError: null,
					updatedAt: new Date(),
				},
			});
		});

		recordMediaMetric({ event: "job", outcome: "completed" });
		logInfo({
			event: "media.job.completed",
			data: {
				jobId: params.jobId,
				assetId: params.assetId,
			},
		});
		await storage.deleteObject({ key: params.sourceStorageKey });
	} catch (error) {
		recordMediaMetric({ event: "job", outcome: "failed" });
		logError({
			event: "media.job.failed",
			data: {
				jobId: params.jobId,
				assetId: params.assetId,
				error: error instanceof Error ? error.message : "unknown error",
			},
		});
		await getDb().$transaction(async (trx) => {
			await trx.postAsset.update({
				where: { id: params.assetId },
				data: {
					processingStatus: "failed",
					updatedAt: new Date(),
				},
			});
			await trx.processingJob.update({
				where: { id: params.jobId },
				data: {
					status: "failed",
					attempts: { increment: 1 },
					lastError: error instanceof Error ? error.message : "unknown error",
					updatedAt: new Date(),
				},
			});
		});
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
}

export async function processPendingMediaJobs(params: {
	limit: number;
}): Promise<number> {
	const jobs = await getDb().processingJob.findMany({
		where: {
			jobType: "video_transcode",
			status: "pending",
		},
		orderBy: { createdAt: "asc" },
		take: params.limit,
	});

	let processed = 0;
	for (const job of jobs) {
		const claimed = await getDb().processingJob.updateMany({
			where: {
				id: job.id,
				status: "pending",
			},
			data: {
				status: "processing",
				updatedAt: new Date(),
			},
		});
		if (claimed.count === 0) {
			continue;
		}

		const payload =
			typeof job.payload === "object" && job.payload
				? (job.payload as {
						assetId?: string;
						sourceStorageKey?: string;
					})
				: {};
		if (!payload.assetId || !payload.sourceStorageKey) {
			await getDb().processingJob.update({
				where: { id: job.id },
				data: {
					status: "failed",
					attempts: { increment: 1 },
					lastError: "Invalid video job payload",
					updatedAt: new Date(),
				},
			});
			processed += 1;
			continue;
		}

		recordMediaMetric({ event: "job", outcome: "started" });
		logInfo({
			event: "media.job.started",
			data: {
				jobId: job.id,
				assetId: payload.assetId,
			},
		});
		await processVideoJob({
			jobId: job.id,
			assetId: payload.assetId,
			sourceStorageKey: payload.sourceStorageKey,
		});
		processed += 1;
	}

	return processed;
}

export async function extractPostUploadsFromMultipartRequest(params: {
	request: Request;
	maxFiles?: number;
}): Promise<{
	actionType: string;
	bodyText: string;
	parentPostId?: string;
	albumTags: string[];
	uploads: ParsedMultipartFile[];
	cleanup(): Promise<void>;
}> {
	const { parseMultipartForm } = await import("./multipart-form.server.ts");
	const parsed = await parseMultipartForm({
		request: params.request,
		maxFiles: params.maxFiles ?? MAX_IMAGES_PER_POST,
		maxFileSizeBytes: MAX_VIDEO_BYTES,
	});
	try {
		const actionType = (parsed.fields.get("_action") ?? "").trim();
		const bodyText = (parsed.fields.get("bodyText") ?? "").trim();
		const parentPostId =
			(parsed.fields.get("parentPostId") ?? "").trim() || undefined;
		const albumTags = parseAlbumTagsInput(parsed.fields.get("assetAlbums"));
		const uploads = parsed.files.filter((file) => file.fieldName === "assets");
		return {
			actionType,
			bodyText,
			parentPostId,
			albumTags,
			uploads,
			async cleanup() {
				await cleanupParsedMultipartForm(parsed);
			},
		};
	} catch (error) {
		await cleanupParsedMultipartForm(parsed);
		throw error;
	}
}
