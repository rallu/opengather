import { Prisma } from "@prisma/client";
import { getDb } from "../db.server.ts";
import { getReadableGroupIds } from "../group.service.server.ts";
import {
	canViewProfile,
	getInstanceViewerRole,
	type ProfileVisibilityMode,
	resolveEffectiveProfileVisibility,
	type ViewerRole,
} from "../permissions.server.ts";
import { loadPostAssetSummaries } from "../post-assets.server.ts";
import { loadPostAuthorSummaryMap } from "../post-author.service.server.ts";
import {
	mapPostListItem,
	type PostListItem,
	type PostListRow,
} from "../post-list.service.server.ts";
import { ensurePostRootIds } from "../post-root.server.ts";
import {
	isUploadedProfileImageOverride,
	resolveEffectiveProfileImage,
} from "../profile-image.server.ts";
import {
	buildVisibleActivities,
	getProfileAuthorIds,
	listProfilePosts,
	type ProfileActivity,
	sanitizeProfileSummary,
	toIsoString,
} from "./shared.ts";
import {
	getProfileVisibility,
	parseProfileVisibilityMode,
} from "./visibility.ts";

type AuthUser = {
	id: string;
	hubUserId?: string;
	name: string;
	email: string;
} | null;

function getProfileScopeCondition(readableGroupIds?: string[]) {
	if (!readableGroupIds) {
		return Prisma.sql`TRUE`;
	}

	if (readableGroupIds.length === 0) {
		return Prisma.sql`p.group_id IS NULL`;
	}

	return Prisma.sql`(p.group_id IS NULL OR p.group_id IN (${Prisma.join(
		readableGroupIds,
	)}))`;
}

async function loadVisibleProfilePostItems(params: {
	instanceId: string;
	profileUserId: string;
	readableGroupIds?: string[];
}): Promise<PostListItem[]> {
	const authorIds = await getProfileAuthorIds({
		userId: params.profileUserId,
	});
	if (authorIds.length === 0) {
		return [];
	}

	await ensurePostRootIds();

	const rows = await getDb().$queryRaw<PostListRow[]>(Prisma.sql`
		WITH visible_posts AS (
			SELECT
				p.id,
				p.parent_post_id,
				p.author_id,
				p.body_text,
				p.group_id,
				p.moderation_status,
				p.hidden_at,
				p.deleted_at,
				p.created_at,
				p.root_post_id
			FROM post p
			WHERE
				p.instance_id = ${params.instanceId}
				AND ${getProfileScopeCondition(params.readableGroupIds)}
				AND p.deleted_at IS NULL
				AND p.hidden_at IS NULL
				AND p.moderation_status <> 'rejected'
		),
		thread_stats AS (
			SELECT
				v.root_post_id,
				COUNT(*) FILTER (WHERE v.parent_post_id IS NOT NULL) AS comment_count,
				MAX(v.created_at) AS latest_activity_at
			FROM visible_posts v
			GROUP BY v.root_post_id
		),
		root_posts AS (
			SELECT
				v.id,
				v.parent_post_id,
				v.author_id,
				v.body_text,
				v.group_id,
				g.name AS group_name,
				v.moderation_status,
				v.hidden_at,
				v.deleted_at,
				v.created_at,
				ts.comment_count,
				ts.latest_activity_at
			FROM visible_posts v
			INNER JOIN thread_stats ts ON ts.root_post_id = v.id
			LEFT JOIN community_group g ON g.id = v.group_id
			WHERE
				v.parent_post_id IS NULL
				AND v.author_id IN (${Prisma.join(authorIds)})
		)
		SELECT
			root_posts.id,
			root_posts.parent_post_id AS "parentPostId",
			root_posts.author_id AS "authorId",
			root_posts.body_text AS "bodyText",
			root_posts.group_id AS "groupId",
			root_posts.group_name AS "groupName",
			root_posts.moderation_status AS "moderationStatus",
			root_posts.hidden_at AS "hiddenAt",
			root_posts.deleted_at AS "deletedAt",
			root_posts.created_at AS "createdAt",
			root_posts.comment_count AS "commentCount",
			root_posts.latest_activity_at AS "latestActivityAt"
		FROM root_posts
		ORDER BY root_posts.created_at DESC, root_posts.id DESC
		LIMIT 40
	`);

	const [assetMap, authorMap] = await Promise.all([
		loadPostAssetSummaries({
			postIds: rows.map((row) => row.id),
		}),
		loadPostAuthorSummaryMap({
			authorIds: rows.map((row) => row.authorId),
		}),
	]);

	return rows.map((row) => ({
		...mapPostListItem(
			row,
			"newest",
			authorMap.get(row.authorId) ?? { id: row.authorId, name: "Member" },
		),
		assets: assetMap.get(row.id) ?? [],
	}));
}

export async function listVisibleProfiles(params: {
	instanceId: string;
	viewer: AuthUser;
	instanceViewerRole: ViewerRole;
	instanceVisibilityMode: "public" | "registered" | "approval";
}): Promise<
	Array<{
		id: string;
		name: string;
		image: string | null;
		summary: string | null;
		profileVisibility: ProfileVisibilityMode;
		isSelf: boolean;
	}>
> {
	const memberships = await getDb().instanceMembership.findMany({
		where: {
			instanceId: params.instanceId,
			principalType: "user",
			approvalStatus: "approved",
		},
		select: { principalId: true },
	});
	const userIds = [
		...new Set(memberships.map((membership) => membership.principalId)),
	];
	if (userIds.length === 0) {
		return [];
	}

	const [users, profilePreferences] = await Promise.all([
		getDb().user.findMany({
			where: { id: { in: userIds } },
			select: {
				id: true,
				name: true,
				image: true,
				imageOverride: true,
			},
		}),
		getDb().profilePreference.findMany({
			where: { userId: { in: userIds } },
			select: {
				userId: true,
				visibilityMode: true,
				summary: true,
			},
		}),
	]);
	const profilePreferenceMap = new Map(
		profilePreferences.map((preference) => [preference.userId, preference]),
	);

	return users
		.map((user) => {
			const preference = profilePreferenceMap.get(user.id);
			const profileVisibility = resolveEffectiveProfileVisibility({
				instanceVisibilityMode: params.instanceVisibilityMode,
				visibilityMode: parseProfileVisibilityMode(preference?.visibilityMode),
			});
			const visibilityResult = canViewProfile({
				isAuthenticated: Boolean(params.viewer),
				isSelf: user.id === params.viewer?.id,
				instanceViewerRole: params.instanceViewerRole,
				visibilityMode: profileVisibility,
			});
			if (!visibilityResult.allowed) {
				return null;
			}
			return {
				id: user.id,
				name: user.name,
				image: resolveEffectiveProfileImage(user),
				summary: preference?.summary
					? sanitizeProfileSummary(preference.summary)
					: null,
				profileVisibility,
				isSelf: user.id === params.viewer?.id,
			};
		})
		.filter(
			(
				profile,
			): profile is {
				id: string;
				name: string;
				image: string | null;
				summary: string | null;
				profileVisibility: ProfileVisibilityMode;
				isSelf: boolean;
			} => Boolean(profile),
		)
		.sort((left, right) => left.name.localeCompare(right.name));
}
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

export async function loadVisibleProfile(params: {
	profileUserId: string;
	viewer: AuthUser;
	instanceId: string;
}): Promise<
	| { status: "not_found" }
	| { status: "requires_authentication" }
	| { status: "forbidden" }
	| {
			status: "ok";
			name: string;
			image: string | null;
			summary: string | null;
			profileVisibility: ProfileVisibilityMode;
			posts: PostListItem[];
			stats: {
				totalPosts: number;
				topLevelPosts: number;
				replies: number;
			};
			isSelf: boolean;
			viewerRole: ViewerRole;
	  }
> {
	const db = getDb();
	const [profileUser, preferenceRow] = await Promise.all([
		db.user.findUnique({
			where: { id: params.profileUserId },
			select: {
				id: true,
				name: true,
				image: true,
				imageOverride: true,
			},
		}),
		db.profilePreference.findUnique({
			where: { userId: params.profileUserId },
			select: { summary: true },
		}),
	]);
	if (!profileUser) {
		return { status: "not_found" };
	}

	const profileVisibility = await getProfileVisibility({
		userId: params.profileUserId,
	});
	const isSelf = params.viewer?.id === params.profileUserId;
	const viewerRole = params.viewer
		? await getInstanceViewerRole({
				instanceId: params.instanceId,
				userId: params.viewer.id,
			})
		: "guest";
	const decision = canViewProfile({
		isAuthenticated: Boolean(params.viewer),
		isSelf,
		instanceViewerRole: viewerRole,
		visibilityMode: profileVisibility,
	});
	if (!decision.allowed) {
		return {
			status:
				decision.reason === "requires_authentication"
					? "requires_authentication"
					: "forbidden",
		};
	}

	const readableGroupIds = isSelf
		? undefined
		: await getReadableGroupIds({
				authUser: params.viewer,
				instanceViewerRole: viewerRole,
			});
	const [postRows, posts] = await Promise.all([
		listProfilePosts({
			instanceId: params.instanceId,
			profileUserId: params.profileUserId,
			readableGroupIds,
		}),
		loadVisibleProfilePostItems({
			instanceId: params.instanceId,
			profileUserId: params.profileUserId,
			readableGroupIds,
		}),
	]);
	const replies = postRows.filter((post) => Boolean(post.parentPostId)).length;

	return {
		status: "ok",
		name: profileUser.name,
		image: resolveEffectiveProfileImage(profileUser),
		summary: preferenceRow?.summary
			? sanitizeProfileSummary(preferenceRow.summary)
			: null,
		profileVisibility,
		posts,
		stats: {
			totalPosts: postRows.length,
			topLevelPosts: postRows.length - replies,
			replies,
		},
		isSelf,
		viewerRole,
	};
}
