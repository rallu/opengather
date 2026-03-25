import { randomUUID } from "node:crypto";

import sharp from "sharp";

import {
	type AssetStorage,
	getAssetDirectoryPrefix,
} from "../asset-storage.server.ts";
import type { ParsedMultipartFile } from "../multipart-form.server.ts";
import {
	IMAGE_VARIANT_SPECS,
	inferExtensionFromMimeType,
	type PreparedDbAsset,
	type PreparedDbVariant,
	trimFilename,
} from "./shared.ts";
import { writeFileToStorage } from "./storage.ts";

export async function createImageVariants(params: {
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
	const prefix = getAssetDirectoryPrefix({ assetId: params.assetId });
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
			assetId: params.assetId,
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
			assetId: params.assetId,
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
			id: params.assetId,
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

export function pickImageVariantFormat(
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
