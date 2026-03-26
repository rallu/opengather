import {
	buildSearchExcerpt,
	SEARCH_PEOPLE_LIMIT,
	SEARCH_POSTS_LIMIT,
	type SearchPostResult,
	type SearchProfileResult,
} from "~/lib/search";
import { getDb } from "./db.server.ts";
import { getReadableGroupIds } from "./group.service.server.ts";
import {
	canViewProfile,
	type InstanceVisibilityMode,
	resolveEffectiveProfileVisibility,
	type ViewerRole,
} from "./permissions.server.ts";
import { loadPostAuthorSummaryMap } from "./post-author.service.server.ts";
import { sanitizeProfileSummary } from "./profile.service.server/shared.ts";
import { parseProfileVisibilityMode } from "./profile.service.server/visibility.ts";

type SearchAuthUser = {
	id: string;
	hubUserId?: string;
	name: string;
	email: string;
} | null;

type RankedSearchProfileResult = SearchProfileResult & {
	rank: number;
};

function getProfileMatchRank(
	name: string,
	query: string,
	isSelf: boolean,
): number {
	if (isSelf) {
		return -1;
	}

	const normalizedName = name.trim().toLowerCase();
	const normalizedQuery = query.toLowerCase();

	if (normalizedName === normalizedQuery) {
		return 0;
	}
	if (normalizedName.startsWith(normalizedQuery)) {
		return 1;
	}
	return 2;
}

export async function searchProfiles(params: {
	query: string;
	authUser: SearchAuthUser;
	instanceId: string;
	instanceVisibilityMode: InstanceVisibilityMode;
	viewerRole: ViewerRole;
}): Promise<SearchProfileResult[]> {
	const db = getDb();
	const users = await db.user.findMany({
		where: {
			name: {
				contains: params.query,
				mode: "insensitive",
			},
		},
		orderBy: [{ name: "asc" }, { createdAt: "asc" }],
		take: SEARCH_PEOPLE_LIMIT * 4,
		select: {
			id: true,
			name: true,
			image: true,
		},
	});

	if (users.length === 0) {
		return [];
	}

	const userIds = users.map((user) => user.id);
	const [memberships, preferences] = await Promise.all([
		db.instanceMembership.findMany({
			where: {
				instanceId: params.instanceId,
				principalType: "user",
				approvalStatus: "approved",
				principalId: { in: userIds },
			},
			select: {
				principalId: true,
			},
		}),
		db.profilePreference.findMany({
			where: {
				userId: { in: userIds },
			},
			select: {
				userId: true,
				summary: true,
				visibilityMode: true,
			},
		}),
	]);

	const memberIds = new Set(
		memberships.map((membership) => membership.principalId),
	);
	const preferenceMap = new Map(
		preferences.map((preference) => [preference.userId, preference]),
	);
	const results: RankedSearchProfileResult[] = [];

	for (const user of users) {
		if (!memberIds.has(user.id)) {
			continue;
		}

		const preference = preferenceMap.get(user.id);
		const visibilityMode = resolveEffectiveProfileVisibility({
			instanceVisibilityMode: params.instanceVisibilityMode,
			visibilityMode: parseProfileVisibilityMode(preference?.visibilityMode),
		});
		const decision = canViewProfile({
			isAuthenticated: Boolean(params.authUser),
			isSelf: params.authUser?.id === user.id,
			instanceViewerRole: params.viewerRole,
			visibilityMode,
		});

		if (!decision.allowed) {
			continue;
		}

		results.push({
			id: user.id,
			name: user.name.trim() || "Member",
			imageSrc: user.image ?? undefined,
			summary: sanitizeProfileSummary(preference?.summary) ?? undefined,
			profilePath: `/profiles/${user.id}`,
			rank: getProfileMatchRank(
				user.name,
				params.query,
				params.authUser?.id === user.id,
			),
		});
	}

	return results
		.sort((left, right) => {
			if (left.rank !== right.rank) {
				return left.rank - right.rank;
			}
			return left.name.localeCompare(right.name);
		})
		.slice(0, SEARCH_PEOPLE_LIMIT)
		.map(({ rank: _rank, ...result }) => result);
}

export async function searchPosts(params: {
	query: string;
	authUser: SearchAuthUser;
	instanceId: string;
	viewerRole: ViewerRole;
}): Promise<SearchPostResult[]> {
	const db = getDb();
	const readableGroupIds = await getReadableGroupIds({
		authUser: params.authUser,
		instanceViewerRole: params.viewerRole,
	});

	const posts = await db.post.findMany({
		where: {
			instanceId: params.instanceId,
			deletedAt: null,
			hiddenAt: null,
			moderationStatus: { not: "rejected" },
			bodyText: {
				contains: params.query,
				mode: "insensitive",
			},
			OR:
				readableGroupIds.length > 0
					? [{ groupId: null }, { groupId: { in: readableGroupIds } }]
					: [{ groupId: null }],
		},
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		take: SEARCH_POSTS_LIMIT,
		select: {
			id: true,
			authorId: true,
			bodyText: true,
			group: {
				select: {
					name: true,
				},
			},
		},
	});

	if (posts.length === 0) {
		return [];
	}

	const authorMap = await loadPostAuthorSummaryMap({
		authorIds: posts.map((post) => post.authorId),
	});

	return posts.map((post) => {
		const author = authorMap.get(post.authorId);
		return {
			id: post.id,
			authorName: author?.name ?? "Member",
			excerpt: buildSearchExcerpt(post.bodyText),
			postPath: `/posts/${post.id}`,
			groupName: post.group?.name ?? undefined,
		};
	});
}
