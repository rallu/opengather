import { getDb } from "../db.server.ts";
import { getReadableGroupIds } from "../group.service.server.ts";
import {
	canViewProfile,
	getInstanceViewerRole,
	type ProfileVisibilityMode,
	type ViewerRole,
} from "../permissions.server.ts";
import {
	buildVisibleActivities,
	listProfilePosts,
	type ProfileActivity,
	sanitizeProfileSummary,
	toIsoString,
} from "./shared.ts";
import { getProfileVisibility } from "./visibility.ts";

type AuthUser = {
	id: string;
	hubUserId?: string;
	name: string;
	email: string;
} | null;

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
		image: userRow.image,
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
			activities: ProfileActivity[];
			stats: {
				totalPosts: number;
				topLevelPosts: number;
				replies: number;
			};
			isSelf: boolean;
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
	const postRows = await listProfilePosts({
		instanceId: params.instanceId,
		profileUserId: params.profileUserId,
		readableGroupIds,
	});
	const replies = postRows.filter((post) => Boolean(post.parentPostId)).length;

	return {
		status: "ok",
		name: profileUser.name,
		image: profileUser.image,
		summary: preferenceRow?.summary
			? sanitizeProfileSummary(preferenceRow.summary)
			: null,
		profileVisibility,
		activities: buildVisibleActivities({ rows: postRows }),
		stats: {
			totalPosts: postRows.length,
			topLevelPosts: postRows.length - replies,
			replies,
		},
		isSelf,
	};
}
