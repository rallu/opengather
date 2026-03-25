import { randomUUID } from "node:crypto";

import {
	type AssetStorage,
	getAssetDirectoryPrefix,
} from "../asset-storage.server.ts";
import { getDb } from "../db.server.ts";
import { logInfo } from "../logger.server.ts";
import { recordMediaMetric } from "../metrics.server.ts";
import type { ParsedMultipartFile } from "../multipart-form.server.ts";
import {
	inferExtensionFromMimeType,
	MAX_VIDEO_BYTES,
	MAX_VIDEO_DURATION_SECONDS,
	type PreparedDbAsset,
	trimFilename,
} from "./shared.ts";
import { writeFileToStorage } from "./storage.ts";
import { processVideoJob } from "./video-job.ts";
import { probeVideo } from "./video-probe.ts";

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
			data: { jobId: job.id, assetId: payload.assetId },
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
