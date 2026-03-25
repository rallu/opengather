import { getDb } from "../db.server.ts";

export type ProfileActivity = {
	id: string;
	label: string;
	body?: string;
	targetUrl?: string;
	createdAt: string;
};

type ProfilePostRow = {
	id: string;
	bodyText: string | null;
	parentPostId: string | null;
	createdAt: Date;
	group: { id: string; name: string } | null;
};

export function sanitizeProfileSummary(
	raw: string | null | undefined,
): string | null {
	const summary = (raw ?? "").trim();
	if (!summary) {
		return null;
	}
	if (summary.length <= 300) {
		return summary;
	}
	return summary.slice(0, 300);
}

export function toIsoString(value: Date | string): string {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

export function buildTargetUrl(params: {
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

export async function listProfilePosts(params: {
	instanceId: string;
	profileUserId: string;
	readableGroupIds?: string[];
}): Promise<ProfilePostRow[]> {
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

export function buildVisibleActivities(params: {
	rows: ProfilePostRow[];
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
