import { randomUUID } from "node:crypto";
import { getConfig } from "./config.service.server.ts";
import { getDb } from "./db.server.ts";
import { getReadableGroupIds } from "./group.service.server.ts";
import {
	canViewProfile,
	getAllowedProfileVisibilityModes,
	getInstanceViewerRole,
	type InstanceVisibilityMode,
	type ProfileVisibilityMode,
	resolveEffectiveProfileVisibility,
	type ViewerRole,
} from "./permissions.server.ts";

type AuthUser = {
	id: string;
	hubUserId?: string;
	name: string;
	email: string;
} | null;

export type ProfileActivity = {
	id: string;
	label: string;
	body?: string;
	targetUrl?: string;
	createdAt: string;
};

export function parseProfileVisibilityMode(
	raw: string | null | undefined,
): ProfileVisibilityMode {
	if (raw === "public" || raw === "instance_members" || raw === "private") {
		return raw;
	}
	return "public";
}

export async function getProfileVisibility(params: {
	userId: string;
}): Promise<ProfileVisibilityMode> {
	const [preference, instanceVisibilityMode] = await Promise.all([
		getDb().profilePreference.findUnique({
			where: { userId: params.userId },
			select: { visibilityMode: true },
		}),
		getConfig("server_visibility_mode"),
	]);
	return resolveEffectiveProfileVisibility({
		instanceVisibilityMode,
		visibilityMode: parseProfileVisibilityMode(preference?.visibilityMode),
	});
}

export async function setProfileVisibility(params: {
	userId: string;
	visibilityMode: ProfileVisibilityMode;
}): Promise<void> {
	const now = new Date();
	const instanceVisibilityMode = await getConfig("server_visibility_mode");
	const visibilityMode = resolveEffectiveProfileVisibility({
		instanceVisibilityMode,
		visibilityMode: params.visibilityMode,
	});
	await getDb().profilePreference.upsert({
		where: { userId: params.userId },
		create: {
			id: randomUUID(),
			userId: params.userId,
			visibilityMode,
			createdAt: now,
			updatedAt: now,
		},
		update: {
			visibilityMode,
			updatedAt: now,
		},
	});
}

export function listProfileVisibilityOptions(params: {
	instanceVisibilityMode: InstanceVisibilityMode;
}): Array<{ value: ProfileVisibilityMode; label: string }> {
	const allowedValues = getAllowedProfileVisibilityModes({
		instanceVisibilityMode: params.instanceVisibilityMode,
	});

	return allowedValues.map((value) => ({
		value,
		label:
			value === "public"
				? "Public"
				: value === "instance_members"
					? "Instance members"
					: "Private",
	}));
}

function toIsoString(value: Date | string): string {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function buildTargetUrl(params: {
	postId: string;
	group?: {
		id: string;
		name: string;
	} | null;
}): string {
	if (params.group?.id) {
		return `/groups/${params.group.id}#post-${params.postId}`;
	}
	return `/feed#post-${params.postId}`;
}

async function getProfileAuthorIds(params: {
	userId: string;
}): Promise<string[]> {
	const user = await getDb().user.findUnique({
		where: { id: params.userId },
		select: {
			id: true,
			accounts: {
				where: { providerId: "hub" },
				select: { accountId: true },
				take: 1,
			},
		},
	});
	if (!user) {
		return [];
	}
	return [user.id, user.accounts[0]?.accountId].filter(
		(value): value is string => Boolean(value),
	);
}

async function listProfilePosts(params: {
	instanceId: string;
	profileUserId: string;
	readableGroupIds?: string[];
}): Promise<
	Array<{
		id: string;
		bodyText: string | null;
		parentPostId: string | null;
		createdAt: Date;
		group: { id: string; name: string } | null;
	}>
> {
	const authorIds = await getProfileAuthorIds({ userId: params.profileUserId });
	if (authorIds.length === 0) {
		return [];
	}

	return getDb().post.findMany({
		where: {
			instanceId: params.instanceId,
			authorId: { in: authorIds },
			deletedAt: null,
			hiddenAt: null,
			moderationStatus: { not: "rejected" },
			OR: params.readableGroupIds
				? params.readableGroupIds.length > 0
					? [{ groupId: null }, { groupId: { in: params.readableGroupIds } }]
					: [{ groupId: null }]
				: undefined,
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
	});
}

function buildVisibleActivities(params: {
	rows: Array<{
		id: string;
		bodyText: string | null;
		parentPostId: string | null;
		createdAt: Date;
		group: { id: string; name: string } | null;
	}>;
}): ProfileActivity[] {
	return params.rows.map((row) => ({
		id: row.id,
		label: row.parentPostId ? "Replied to a post" : "Published a post",
		body: row.bodyText ?? undefined,
		targetUrl: buildTargetUrl({
			postId: row.id,
			group: row.group,
		}),
		createdAt: row.createdAt.toISOString(),
	}));
}

export async function loadOwnProfile(params: {
	userId: string;
	hubUserId?: string;
	instanceId: string;
	instanceName: string;
	viewerRole: ViewerRole;
	name: string;
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
	  }
> {
	const db = getDb();
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
			targetUrl: buildTargetUrl({
				postId: row.postId,
				group: row.post.group,
			}),
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
		name: params.name,
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
	const profileUser = await db.user.findUnique({
		where: { id: params.profileUserId },
		select: {
			id: true,
			name: true,
		},
	});
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
