import { Prisma } from "@prisma/client";

import { getDb } from "../db.server.ts";
import { buildVariantUrl, type PostAssetSummary, stripFilenameExtension, toAssetKind, toProcessingStatus } from "./shared.ts";

export async function loadPostAssetSummaries(params: {
	postIds: string[];
}): Promise<Map<string, PostAssetSummary[]>> {
	if (params.postIds.length === 0) {
		return new Map();
	}

	const assets = await getDb().postAsset.findMany({
		where: { postId: { in: params.postIds } },
		include: { variants: { orderBy: [{ variantKey: "asc" }, { format: "asc" }] } },
		orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
	});

	const byPostId = new Map<string, PostAssetSummary[]>();
	for (const asset of assets) {
		const summary: PostAssetSummary = {
			id: asset.id,
			kind: toAssetKind(asset.kind),
			processingStatus: toProcessingStatus(asset.processingStatus),
			alt: asset.originalFilename ? stripFilenameExtension(asset.originalFilename) : undefined,
			albumTags: asset.albumTags,
			width: asset.width ?? undefined,
			height: asset.height ?? undefined,
			durationSeconds: asset.durationSeconds ?? undefined,
			variants: {},
		};

		if (asset.variants.some((variant) => variant.variantKey === "image-large")) summary.variants.large = buildVariantUrl(asset.id, "image-large");
		if (asset.variants.some((variant) => variant.variantKey === "image-small")) summary.variants.small = buildVariantUrl(asset.id, "image-small");
		if (asset.variants.some((variant) => variant.variantKey === "image-thumbnail")) summary.variants.thumbnail = buildVariantUrl(asset.id, "image-thumbnail");
		if (asset.variants.some((variant) => variant.variantKey === "video-playback")) summary.variants.playback = buildVariantUrl(asset.id, "video-playback");
		if (asset.variants.some((variant) => variant.variantKey === "video-poster")) summary.variants.poster = buildVariantUrl(asset.id, "video-poster");
		if (!summary.variants.thumbnail && asset.variants.some((variant) => variant.variantKey === "video-thumbnail")) summary.variants.thumbnail = buildVariantUrl(asset.id, "video-thumbnail");

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
	const authorIds = [...new Set([params.userId, params.hubUserId].filter(Boolean))];
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
