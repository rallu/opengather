import type { Prisma } from "@prisma/client";

export const MAX_IMAGES_PER_POST = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 60;
export const MAX_ALBUM_TAGS_PER_ASSET = 8;
export const MAX_ALBUM_TAG_LENGTH = 48;

export const IMAGE_MIME_TYPES = new Set([
	"image/avif",
	"image/jpeg",
	"image/png",
	"image/webp",
]);

export const VIDEO_MIME_TYPES = new Set([
	"video/mp4",
	"video/quicktime",
	"video/webm",
]);

export const IMAGE_VARIANT_SPECS = [
	{ key: "image-large", width: 1600, height: 1600, fit: "inside" as const },
	{ key: "image-small", width: 800, height: 800, fit: "inside" as const },
	{ key: "image-thumbnail", width: 320, height: 320, fit: "cover" as const },
];

export type AssetKind = "image" | "video";
export type AssetProcessingStatus = "pending" | "ready" | "failed";

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

export type PreparedDbAsset = {
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

export type PreparedDbVariant = {
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

export type PreparedPostAssetPersistence = {
	persist(trx: Prisma.TransactionClient): Promise<void>;
	cleanup(): Promise<void>;
};

export type ProbedVideo = {
	durationSeconds: number;
	width: number;
	height: number;
};

export function buildVariantUrl(assetId: string, variantKey: string): string {
	return `/media/${assetId}/${variantKey}`;
}

export function inferExtensionFromMimeType(mimeType: string): string {
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

export function trimFilename(filename: string): string {
	return (
		filename
			.trim()
			.replace(/[^\w.-]+/g, "-")
			.slice(0, 120) || "upload"
	);
}

export function stripFilenameExtension(filename: string): string {
	return filename.replace(/\.[^.]+$/, "");
}

export function toProcessingStatus(value: string): AssetProcessingStatus {
	return value === "ready" || value === "failed" ? value : "pending";
}

export function toAssetKind(value: string): AssetKind {
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

		const normalizedKey = albumTag.toLocaleLowerCase();
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
