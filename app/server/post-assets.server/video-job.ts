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
import { runCommand } from "./commands.ts";
import {
	MAX_VIDEO_DURATION_SECONDS,
	type PreparedDbVariant,
} from "./shared.ts";
import { writeGeneratedFile } from "./storage.ts";
import { probeVideo } from "./video-probe.ts";

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

export async function processVideoJob(params: {
	jobId: string;
	assetId: string;
	sourceStorageKey: string;
}): Promise<void> {
	const storage = await getAssetStorage();
	const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengather-video-"));
	const sourcePath = path.join(tempDir, "source");
	const playbackPath = path.join(tempDir, "playback.mp4");
	const posterPath = path.join(tempDir, "poster.png");

	try {
		await storage.materializeToFile({
			key: params.sourceStorageKey,
			filePath: sourcePath,
		});

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
			data: { jobId: params.jobId, assetId: params.assetId },
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
				data: { processingStatus: "failed", updatedAt: new Date() },
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
