import { getDb } from "../db.server.ts";
import type {
	ProfileVisibilityMode,
	ViewerRole,
} from "../permissions.server.ts";
import {
	isUploadedProfileImageOverride,
	resolveEffectiveProfileImage,
} from "../profile-image.server.ts";
import {
	buildVisibleActivities,
	type ProfileActivity,
	sanitizeProfileSummary,
	toIsoString,
} from "./shared.ts";
import { getProfileVisibility } from "./visibility.ts";
export async function loadOwnProfile(params: {
	userId: string;
	hubUserId?: string;
	instanceId: string;
	instanceName: string;
	viewerRole: ViewerRole;
}): Promise<
	| {
			status: "not_found";
	  }
	| {
			status: "ok";
			profileVisibility: ProfileVisibilityMode;
			stats: {
				totalPosts: number;
				topLevelPosts: number;
				replies: number;
				moderationActions: number;
			};
			activities: ProfileActivity[];
			publicProfilePath: string;
			instanceName: string;
			viewerRole: ViewerRole;
			name: string;
			image: string | null;
			imageOverride: string | null;
			imageSource:
				| "hub"
				| "local_upload"
				| "local_url"
				| "default"
				| "generated_default"
				| "none";
			summary: string | null;
	  }
> {
	const db = getDb();
	const [userRow, preferenceRow] = await Promise.all([
		db.user.findUnique({
			where: { id: params.userId },
			select: {
				name: true,
				image: true,
				imageOverride: true,
			},
		}),
		db.profilePreference.findUnique({
			where: { userId: params.userId },
			select: { summary: true },
		}),
	]);
	if (!userRow) {
		return { status: "not_found" };
	}

	const authorIds = [params.userId, params.hubUserId].filter(
		(value): value is string => Boolean(value),
	);
	if (authorIds.length === 0) {
		return { status: "not_found" };
	}

	const [profileVisibility, postRows, moderationRows] = await Promise.all([
		getProfileVisibility({ userId: params.userId }),
		db.post.findMany({
			where: {
				instanceId: params.instanceId,
				authorId: { in: authorIds },
			},
			orderBy: { createdAt: "desc" },
			take: 40,
			select: {
				id: true,
				bodyText: true,
				parentPostId: true,
				createdAt: true,
				group: {
					select: {
						id: true,
						name: true,
					},
				},
			},
		}),
		db.moderationDecision.findMany({
			where: {
				actorType: "human",
				actorId: { in: authorIds },
			},
			orderBy: { createdAt: "desc" },
			take: 40,
			select: {
				id: true,
				status: true,
				postId: true,
				createdAt: true,
				post: {
					select: {
						bodyText: true,
						group: {
							select: {
								id: true,
								name: true,
							},
						},
					},
				},
			},
		}),
	]);

	const activities: ProfileActivity[] = [
		...buildVisibleActivities({ rows: postRows }),
		...moderationRows.map((row) => ({
			id: row.id,
			label: `Moderated a post (${row.status})`,
			body: row.post.bodyText ?? undefined,
			targetUrl: row.postId
				? row.post.group?.id
					? `/groups/${row.post.group.id}#post-${row.postId}`
					: `/feed#post-${row.postId}`
				: undefined,
			createdAt: toIsoString(row.createdAt),
		})),
	].sort(
		(left, right) =>
			new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
	);

	const replies = postRows.filter((post) => Boolean(post.parentPostId)).length;
	const effectiveImage = resolveEffectiveProfileImage({
		id: params.userId,
		...userRow,
	});
	const hasUploadedOverride = isUploadedProfileImageOverride(
		userRow.imageOverride,
	);
	const hasImageOverride = Boolean(userRow.imageOverride?.trim());
	const imageSource = hasUploadedOverride
		? "local_upload"
		: hasImageOverride
			? "local_url"
			: params.hubUserId && userRow.image
				? "hub"
				: effectiveImage && !userRow.image
					? "generated_default"
					: userRow.image
						? "default"
						: "none";

	return {
		status: "ok",
		profileVisibility,
		stats: {
			totalPosts: postRows.length,
			topLevelPosts: postRows.length - replies,
			replies,
			moderationActions: moderationRows.length,
		},
		activities: activities.slice(0, 60),
		publicProfilePath: `/profiles/${params.userId}`,
		instanceName: params.instanceName,
		viewerRole: params.viewerRole,
		name: userRow.name,
		image: effectiveImage,
		imageOverride: userRow.imageOverride ?? null,
		imageSource,
		summary: preferenceRow?.summary
			? sanitizeProfileSummary(preferenceRow.summary)
			: null,
	};
}
