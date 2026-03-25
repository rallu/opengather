import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";

import {
	getAssetDirectoryPrefix,
	getAssetStorage,
} from "../asset-storage.server.ts";
import { logInfo, logWarn } from "../logger.server.ts";
import { recordMediaMetric } from "../metrics.server.ts";
import type { ParsedMultipartFile } from "../multipart-form.server.ts";
import { createImageVariants } from "./image-processing.ts";
import {
	IMAGE_MIME_TYPES,
	MAX_IMAGE_BYTES,
	MAX_IMAGES_PER_POST,
	type PreparedPostAssetPersistence,
	VIDEO_MIME_TYPES,
} from "./shared.ts";
import { stageVideoAsset } from "./video-processing.ts";

function assertAcceptedMimeType(
	upload: ParsedMultipartFile,
): "image" | "video" {
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
		return { async persist() {}, async cleanup() {} };
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

	const preparedAssets: Prisma.PostAssetCreateManyInput[] = [];
	const preparedVariants: Prisma.PostAssetVariantCreateManyInput[] = [];
	const preparedJobs: Prisma.ProcessingJobCreateInput[] = [];

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
			preparedJobs.push(prepared.job as Prisma.ProcessingJobCreateInput);
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
