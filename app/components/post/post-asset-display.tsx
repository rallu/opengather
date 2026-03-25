import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { PostAssetSummary } from "~/server/post-assets.server";
import { PostImageContent } from "./post-image-content";
import { PostImageGalleryContent } from "./post-image-gallery-content";
import { PostVideoContent } from "./post-video-content";

function formatDuration(durationSeconds?: number): string | undefined {
	if (!durationSeconds || !Number.isFinite(durationSeconds)) {
		return undefined;
	}
	const totalSeconds = Math.max(0, Math.round(durationSeconds));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function AssetPlaceholder(props: {
	title: string;
	description: string;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground",
				props.className,
			)}
		>
			<p className="font-medium text-foreground">{props.title}</p>
			<p className="mt-1">{props.description}</p>
		</div>
	);
}

function collectAlbumTags(assets: PostAssetSummary[]): string[] {
	const seen = new Set<string>();
	const albumTags: string[] = [];

	for (const asset of assets) {
		if (asset.kind !== "image") {
			continue;
		}

		for (const albumTag of asset.albumTags) {
			const normalizedKey = albumTag.toLowerCase();
			if (seen.has(normalizedKey)) {
				continue;
			}

			seen.add(normalizedKey);
			albumTags.push(albumTag);
		}
	}

	return albumTags;
}

function AssetAlbumTags(props: { albumTags: string[] }) {
	if (props.albumTags.length === 0) {
		return null;
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			<span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
				Albums
			</span>
			{props.albumTags.map((albumTag) => (
				<Badge key={albumTag} variant="neutral">
					{albumTag}
				</Badge>
			))}
		</div>
	);
}

export function PostAssetDisplay(props: {
	assets: PostAssetSummary[];
	playableVideo?: boolean;
	className?: string;
}) {
	if (props.assets.length === 0) {
		return null;
	}

	const firstAsset = props.assets[0];
	if (!firstAsset) {
		return null;
	}

	if (firstAsset.kind === "image") {
		const readyImages = props.assets.filter(
			(asset) => asset.kind === "image" && asset.processingStatus === "ready",
		);
		const albumTags = collectAlbumTags(readyImages);
		if (readyImages.length === 0) {
			return (
				<AssetPlaceholder
					title="Image unavailable"
					description="The image could not be prepared for display."
					className={props.className}
				/>
			);
		}

		if (readyImages.length === 1) {
			const image = readyImages[0];
			const content = (
				<PostImageContent
					src={
						image.variants.large ??
						image.variants.small ??
						image.variants.thumbnail ??
						""
					}
					alt={image.alt ?? "Post image"}
					caption={image.alt}
				/>
			);
			if (albumTags.length === 0) {
				return <div className={props.className}>{content}</div>;
			}
			return (
				<div className={cn("space-y-3", props.className)}>
					{content}
					<AssetAlbumTags albumTags={albumTags} />
				</div>
			);
		}

		const content = (
			<PostImageGalleryContent
				images={readyImages.map((asset) => ({
					src:
						asset.variants.small ??
						asset.variants.large ??
						asset.variants.thumbnail ??
						"",
					alt: asset.alt ?? "Post image",
				}))}
			/>
		);
		if (albumTags.length === 0) {
			return <div className={props.className}>{content}</div>;
		}
		return (
			<div className={cn("space-y-3", props.className)}>
				{content}
				<AssetAlbumTags albumTags={albumTags} />
			</div>
		);
	}

	if (firstAsset.processingStatus === "pending") {
		return (
			<AssetPlaceholder
				title="Video processing"
				description="The video is still being prepared."
				className={props.className}
			/>
		);
	}

	if (firstAsset.processingStatus === "failed") {
		return (
			<AssetPlaceholder
				title="Video unavailable"
				description="The video could not be processed."
				className={props.className}
			/>
		);
	}

	return (
		<PostVideoContent
			src={firstAsset.variants.playback}
			posterSrc={firstAsset.variants.poster ?? firstAsset.variants.thumbnail}
			title={firstAsset.alt}
			duration={formatDuration(firstAsset.durationSeconds)}
			playable={props.playableVideo ?? true}
			className={props.className}
		/>
	);
}
