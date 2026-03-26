import sharp from "sharp";

import { getAssetStorage } from "./asset-storage.server.ts";
import type { ParsedMultipartFile } from "./multipart-form.server.ts";
import { pickImageVariantFormat } from "./post-assets.server/image-processing.ts";
import {
	IMAGE_MIME_TYPES,
	MAX_IMAGE_BYTES,
} from "./post-assets.server/shared.ts";

const PROFILE_IMAGE_ROUTE_PREFIX = "/profile-images/";
const PROFILE_IMAGE_SIZES = [64, 128, 256] as const;

type ProfileImageSize = (typeof PROFILE_IMAGE_SIZES)[number];

type StoredProfileImageParams = {
	image: string | null | undefined;
	imageOverride: string | null | undefined;
};

function normalizeStoredImageValue(
	value: string | null | undefined,
): string | null {
	const trimmed = value?.trim() ?? "";
	return trimmed ? trimmed : null;
}

export function resolveEffectiveProfileImage(
	params: StoredProfileImageParams,
): string | null {
	return (
		normalizeStoredImageValue(params.imageOverride) ??
		normalizeStoredImageValue(params.image)
	);
}

export function isUploadedProfileImageOverride(
	value: string | null | undefined,
): boolean {
	const normalized = normalizeStoredImageValue(value);
	if (!normalized) {
		return false;
	}
	try {
		const parsed =
			normalized.startsWith("http://") || normalized.startsWith("https://")
				? new URL(normalized)
				: new URL(normalized, "http://localhost");
		return parsed.pathname.startsWith(PROFILE_IMAGE_ROUTE_PREFIX);
	} catch {
		return normalized.startsWith(PROFILE_IMAGE_ROUTE_PREFIX);
	}
}

export function buildUploadedProfileImageUrl(params: {
	userId: string;
	version: number;
}): string {
	return `${PROFILE_IMAGE_ROUTE_PREFIX}${encodeURIComponent(params.userId)}/256?v=${params.version}`;
}

export function parseProfileImageOverrideInput(params: {
	image: string | null | undefined;
}):
	| {
			ok: true;
			value: string | null;
	  }
	| { ok: false; error: string } {
	const rawImage = (params.image ?? "").trim();
	if (!rawImage) {
		return { ok: true, value: null };
	}
	if (rawImage.length > 1000) {
		return { ok: false, error: "Image URL is too long." };
	}
	try {
		const parsed = new URL(rawImage);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return {
				ok: false,
				error: "Image URL must start with http:// or https://.",
			};
		}
		return { ok: true, value: parsed.toString() };
	} catch {
		return { ok: false, error: "Image URL is invalid." };
	}
}

function getProfileImageStoragePrefix(params: { userId: string }): string {
	return `profile-images/${params.userId}`;
}

function parseProfileImageSize(
	raw: string | null | undefined,
): ProfileImageSize {
	if (raw === "64" || raw === "128" || raw === "256") {
		return Number(raw) as ProfileImageSize;
	}
	return 256;
}

function getProfileImageStorageKeys(params: {
	userId: string;
	size: ProfileImageSize;
}) {
	const prefix = getProfileImageStoragePrefix(params);
	return {
		prefix,
		avif: `${prefix}/avatar-${params.size}.avif`,
		jpeg: `${prefix}/avatar-${params.size}.jpeg`,
	};
}

export async function deleteUploadedProfileImage(params: {
	userId: string;
}): Promise<void> {
	const storage = await getAssetStorage();
	await storage.deletePrefix({
		prefix: getProfileImageStoragePrefix({ userId: params.userId }),
	});
}

export async function saveUploadedProfileImage(params: {
	userId: string;
	upload: ParsedMultipartFile;
}): Promise<string> {
	if (!IMAGE_MIME_TYPES.has(params.upload.mimeType)) {
		throw new Error("Profile image must be a JPEG, PNG, WebP, or AVIF file.");
	}
	if (params.upload.byteSize > MAX_IMAGE_BYTES) {
		throw new Error("Profile image must be 10 MB or smaller.");
	}

	const metadata = await sharp(params.upload.tempFilePath, {
		failOn: "error",
	})
		.rotate()
		.metadata();
	if (!metadata.width || !metadata.height) {
		throw new Error("Could not process the uploaded profile image.");
	}

	const storage = await getAssetStorage();
	await Promise.all(
		PROFILE_IMAGE_SIZES.flatMap((size) => {
			const pipeline = sharp(params.upload.tempFilePath, { failOn: "error" })
				.rotate()
				.resize({
					width: size,
					height: size,
					fit: "cover",
					position: "centre",
					withoutEnlargement: false,
				});
			const keys = getProfileImageStorageKeys({
				userId: params.userId,
				size,
			});

			return [
				pipeline
					.clone()
					.avif({ quality: 60 })
					.toBuffer()
					.then((buffer) => storage.writeBuffer({ key: keys.avif, buffer })),
				pipeline
					.clone()
					.jpeg({ quality: 82, mozjpeg: true })
					.toBuffer()
					.then((buffer) => storage.writeBuffer({ key: keys.jpeg, buffer })),
			];
		}),
	);

	return buildUploadedProfileImageUrl({
		userId: params.userId,
		version: Date.now(),
	});
}

export async function createProfileImageResponse(params: {
	request: Request;
	userId: string;
	size?: string | null;
}): Promise<Response> {
	const storage = await getAssetStorage();
	const keys = getProfileImageStorageKeys({
		userId: params.userId,
		size: parseProfileImageSize(params.size),
	});
	const [avifExists, jpegExists] = await Promise.all([
		storage.statObject({ key: keys.avif }),
		storage.statObject({ key: keys.jpeg }),
	]);
	const variants = [
		...(avifExists
			? [{ format: "avif", key: keys.avif, mimeType: "image/avif" }]
			: []),
		...(jpegExists
			? [{ format: "jpeg", key: keys.jpeg, mimeType: "image/jpeg" }]
			: []),
	];
	if (variants.length === 0) {
		return new Response("Not found", { status: 404 });
	}

	const format = pickImageVariantFormat(
		params.request.headers.get("accept") ?? "",
		variants,
	);
	const selectedVariant =
		variants.find((variant) => variant.format === format) ?? variants[0];
	if (!selectedVariant) {
		return new Response("Not found", { status: 404 });
	}

	const stream = await storage.createReadStream({ key: selectedVariant.key });
	return new Response(stream as never, {
		headers: {
			"Content-Type": selectedVariant.mimeType,
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}
