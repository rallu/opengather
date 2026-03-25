import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

import {
	type AssetStorage,
	getAssetDirectoryPrefix,
	getAssetStorage,
} from "../asset-storage.server.ts";
import { getDb } from "../db.server.ts";
import { logError, logInfo } from "../logger.server.ts";
import { recordMediaMetric } from "../metrics.server.ts";
import type { ParsedMultipartFile } from "../multipart-form.server.ts";
import { runCommand, runCommandJson } from "./commands.ts";
import { writeFileToStorage, writeGeneratedFile } from "./storage.ts";
import {
	type PreparedDbAsset,
	type PreparedDbVariant,
	type ProbedVideo,
	MAX_VIDEO_BYTES,
	MAX_VIDEO_DURATION_SECONDS,
	inferExtensionFromMimeType,
	trimFilename,
} from "./shared.ts";

export async function probeVideo(filePath: string): Promise<ProbedVideo> {
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

	const durationSeconds = Number(videoStream.duration ?? result.format?.duration ?? 0);
	if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
		throw new Error("Uploaded video duration could not be determined");
	}

	return {
		durationSeconds,
		width: videoStream.width,
		height: videoStream.height,
	};
}

export async function stageVideoAsset(params: {
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
		payload: object;
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
		{ id: randomUUID(), assetId: params.assetId, variantKey: "video-poster", format: "avif", mimeType: "image/avif", storageKey: posterAvifKey, byteSize: posterAvif.byteLength, width: posterAvifMeta.width ?? null, height: posterAvifMeta.height ?? null, durationSeconds: null, createdAt: now },
		{ id: randomUUID(), assetId: params.assetId, variantKey: "video-poster", format: "jpeg", mimeType: "image/jpeg", storageKey: posterJpegKey, byteSize: posterJpeg.byteLength, width: posterJpegMeta.width ?? null, height: posterJpegMeta.height ?? null, durationSeconds: null, createdAt: now },
		{ id: randomUUID(), assetId: params.assetId, variantKey: "video-thumbnail", format: "avif", mimeType: "image/avif", storageKey: thumbAvifKey, byteSize: thumbAvif.byteLength, width: thumbAvifMeta.width ?? null, height: thumbAvifMeta.height ?? null, durationSeconds: null, createdAt: now },
		{ id: randomUUID(), assetId: params.assetId, variantKey: "video-thumbnail", format: "jpeg", mimeType: "image/jpeg", storageKey: thumbJpegKey, byteSize: thumbJpeg.byteLength, width: thumbJpegMeta.width ?? null, height: thumbJpegMeta.height ?? null, durationSeconds: null, createdAt: now },
	];
}

async function processVideoJob(params: {
	jobId: string;
	assetId: string;
	sourceStorageKey: string;
}): Promise<void> {
	const storage = await getAssetStorage();
	const sourcePath = await storage.resolvePath({ key: params.sourceStorageKey });
	const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengather-video-"));
	const playbackPath = path.join(tempDir, "playback.mp4");
	const posterPath = path.join(tempDir, "poster.png");

	try {
		await runCommand("ffmpeg", ["-y", "-i", sourcePath, "-map", "0:v:0", "-map", "0:a?", "-t", String(MAX_VIDEO_DURATION_SECONDS), "-vf", "scale=1280:720:force_original_aspect_ratio=decrease", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", playbackPath]);
		await runCommand("ffmpeg", ["-y", "-ss", "0.5", "-i", sourcePath, "-frames:v", "1", posterPath]);

		const prefix = getAssetDirectoryPrefix({ assetId: params.assetId });
		const playbackKey = `${prefix}/video-playback.mp4`;
		const byteSize = await writeGeneratedFile({ storage, filePath: playbackPath, storageKey: playbackKey });
		const playbackMeta = await probeVideo(playbackPath);
		const variants = await createVideoPosterVariants({ storage, posterPath, assetId: params.assetId });
		variants.unshift({ id: randomUUID(), assetId: params.assetId, variantKey: "video-playback", format: "mp4", mimeType: "video/mp4", storageKey: playbackKey, byteSize, width: playbackMeta.width, height: playbackMeta.height, durationSeconds: playbackMeta.durationSeconds, createdAt: new Date() });

		await getDb().$transaction(async (trx) => {
			await trx.postAssetVariant.deleteMany({ where: { assetId: params.assetId } });
			await trx.postAssetVariant.createMany({ data: variants });
			await trx.postAsset.update({ where: { id: params.assetId }, data: { processingStatus: "ready", width: playbackMeta.width, height: playbackMeta.height, durationSeconds: playbackMeta.durationSeconds, updatedAt: new Date() } });
			await trx.processingJob.update({ where: { id: params.jobId }, data: { status: "completed", attempts: { increment: 1 }, lastError: null, updatedAt: new Date() } });
		});

		recordMediaMetric({ event: "job", outcome: "completed" });
		logInfo({ event: "media.job.completed", data: { jobId: params.jobId, assetId: params.assetId } });
		await storage.deleteObject({ key: params.sourceStorageKey });
	} catch (error) {
		recordMediaMetric({ event: "job", outcome: "failed" });
		logError({ event: "media.job.failed", data: { jobId: params.jobId, assetId: params.assetId, error: error instanceof Error ? error.message : "unknown error" } });
		await getDb().$transaction(async (trx) => {
			await trx.postAsset.update({ where: { id: params.assetId }, data: { processingStatus: "failed", updatedAt: new Date() } });
			await trx.processingJob.update({ where: { id: params.jobId }, data: { status: "failed", attempts: { increment: 1 }, lastError: error instanceof Error ? error.message : "unknown error", updatedAt: new Date() } });
		});
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
}

export async function processPendingMediaJobs(params: {
	limit: number;
}): Promise<number> {
	const jobs = await getDb().processingJob.findMany({
		where: { jobType: "video_transcode", status: "pending" },
		orderBy: { createdAt: "asc" },
		take: params.limit,
	});

	let processed = 0;
	for (const job of jobs) {
		const claimed = await getDb().processingJob.updateMany({
			where: { id: job.id, status: "pending" },
			data: { status: "processing", updatedAt: new Date() },
		});
		if (claimed.count === 0) {
			continue;
		}

		const payload =
			typeof job.payload === "object" && job.payload
				? (job.payload as { assetId?: string; sourceStorageKey?: string })
				: {};
		if (!payload.assetId || !payload.sourceStorageKey) {
			await getDb().processingJob.update({
				where: { id: job.id },
				data: { status: "failed", attempts: { increment: 1 }, lastError: "Invalid video job payload", updatedAt: new Date() },
			});
			processed += 1;
			continue;
		}

		recordMediaMetric({ event: "job", outcome: "started" });
		logInfo({ event: "media.job.started", data: { jobId: job.id, assetId: payload.assetId } });
		await processVideoJob({
			jobId: job.id,
			assetId: payload.assetId,
			sourceStorageKey: payload.sourceStorageKey,
		});
		processed += 1;
	}

	return processed;
}
