export type SharedPostModerationStatus =
	| "pending"
	| "approved"
	| "rejected"
	| "flagged";

export type SharedPostAssetKind = "image" | "video";

export type SharedPostAssetProcessingStatus = "ready" | "pending" | "failed";

export type SharedPostAsset = {
	albumTags: string[];
	alt?: string | null;
	durationSeconds?: number | null;
	kind: SharedPostAssetKind;
	processingStatus: SharedPostAssetProcessingStatus;
	variants: {
		large?: string | null;
		playback?: string | null;
		poster?: string | null;
		small?: string | null;
		thumbnail?: string | null;
	};
};
