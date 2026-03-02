import { randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { getDb } from "./db.server";
import { cosineSimilarity, toTextVector } from "./embedding.service.server";
import { getServerEnv } from "./env.server";
import { processNotificationOutbox } from "./jobs.service.server";
import { extractMentionEmails } from "./mentions.server";
import { getSetupStatus } from "./setup.service.server";

export type CommunityUser = {
	id: string;
	hubUserId?: string;
	role: "admin" | "member" | "moderator";
};

export type CommunityPost = {
	id: string;
	parentPostId?: string;
	bodyText?: string;
	moderationStatus: "pending" | "approved" | "rejected" | "flagged";
	isHidden: boolean;
	isDeleted: boolean;
	createdAt: string;
};

function asModerationStatus(params: {
	value: string;
}): "pending" | "approved" | "rejected" | "flagged" {
	if (
		params.value === "pending" ||
		params.value === "approved" ||
		params.value === "rejected" ||
		params.value === "flagged"
	) {
		return params.value;
	}
	return "pending";
}

function toIsoString(params: { value: Date | string }): string {
	return params.value instanceof Date
		? params.value.toISOString()
		: new Date(params.value).toISOString();
}

async function membershipRole(params: {
	instanceId: string;
	userId: string;
}): Promise<"guest" | "member" | "moderator" | "admin"> {
	const db = getDb();
	const membership = await db.instanceMembership.findFirst({
		where: {
			instanceId: params.instanceId,
			principalId: params.userId,
			principalType: "user",
		},
		select: { role: true, approvalStatus: true },
	});

	if (!membership || membership.approvalStatus !== "approved") {
		return "guest";
	}
	return membership.role as "member" | "moderator" | "admin";
}

async function ensureMembershipForUser(params: {
	instanceId: string;
	approvalMode: "automatic" | "manual";
	user: CommunityUser | null;
}): Promise<void> {
	if (!params.user) {
		return;
	}

	const db = getDb();
	const existing = await db.instanceMembership.findFirst({
		where: {
			instanceId: params.instanceId,
			principalId: params.user.id,
			principalType: "user",
		},
		select: { id: true },
	});
	if (existing) {
		return;
	}

	await db.instanceMembership.create({
		data: {
			id: randomUUID(),
			instanceId: params.instanceId,
			principalId: params.user.id,
			principalType: "user",
			role: "member",
			approvalStatus:
				params.approvalMode === "automatic" ? "approved" : "pending",
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	});
}

async function ensureCanRead(params: {
	instanceId: string;
	user: CommunityUser | null;
}): Promise<boolean> {
	const db = getDb();
	const instance = await db.instance.findUnique({
		where: { id: params.instanceId },
		select: { visibilityMode: true },
	});
	if (!instance) {
		return false;
	}

	if (instance.visibilityMode === "public") {
		return true;
	}

	if (!params.user) {
		return false;
	}

	const role = await membershipRole({
		instanceId: params.instanceId,
		userId: params.user.id,
	});
	return role !== "guest";
}

async function ensureCanPost(params: {
	instanceId: string;
	user: CommunityUser | null;
}): Promise<boolean> {
	if (!params.user) {
		return false;
	}
	const role = await membershipRole({
		instanceId: params.instanceId,
		userId: params.user.id,
	});
	return role === "member" || role === "moderator" || role === "admin";
}

async function isAdmin(params: {
	instanceId: string;
	user: CommunityUser | null;
}): Promise<boolean> {
	if (!params.user) {
		return false;
	}
	const role = await membershipRole({
		instanceId: params.instanceId,
		userId: params.user.id,
	});
	return role === "admin";
}

function mapPost(params: {
	row: {
		id: string;
		parentPostId: string | null;
		bodyText: string | null;
		moderationStatus: string;
		hiddenAt: Date | string | null;
		deletedAt: Date | string | null;
		createdAt: Date | string;
	};
}): CommunityPost {
	return {
		id: params.row.id,
		parentPostId: params.row.parentPostId ?? undefined,
		bodyText: params.row.bodyText ?? undefined,
		moderationStatus: asModerationStatus({
			value: params.row.moderationStatus,
		}),
		isHidden: Boolean(params.row.hiddenAt),
		isDeleted: Boolean(params.row.deletedAt),
		createdAt: toIsoString({ value: params.row.createdAt }),
	};
}

export async function loadCommunity(params: {
	user: CommunityUser | null;
	query?: string;
}): Promise<{
	status: "ok" | "not_setup" | "forbidden";
	viewerRole: "guest" | "member" | "moderator" | "admin";
	posts: CommunityPost[];
	search: Array<{ post: CommunityPost; score: number }>;
}> {
	const status = await getSetupStatus();
	if (!status.isSetup || !status.instance) {
		return { status: "not_setup", viewerRole: "guest", posts: [], search: [] };
	}

	await ensureMembershipForUser({
		instanceId: status.instance.id,
		approvalMode: status.instance.approvalMode,
		user: params.user,
	});

	const viewerRole = params.user
		? await membershipRole({
				instanceId: status.instance.id,
				userId: params.user.id,
			})
		: "guest";

	const canRead = await ensureCanRead({
		instanceId: status.instance.id,
		user: params.user,
	});
	if (!canRead) {
		return { status: "forbidden", viewerRole, posts: [], search: [] };
	}

	const db = getDb();
	const includeHidden = await isAdmin({
		instanceId: status.instance.id,
		user: params.user,
	});
	const rows = await db.post.findMany({
		where: { instanceId: status.instance.id },
		orderBy: { createdAt: "asc" },
	});

	const visible = rows.filter((row) => {
		if (includeHidden) {
			return true;
		}
		return (
			!row.deletedAt && !row.hiddenAt && row.moderationStatus !== "rejected"
		);
	});

	let search: Array<{ post: CommunityPost; score: number }> = [];
	if (params.query && params.query.trim().length > 0) {
		const embeddings = await db.postEmbedding.findMany({
			where: {
				sourceType: "text",
				post: { instanceId: status.instance.id },
			},
			select: {
				postId: true,
				vector: true,
				post: {
					select: {
						deletedAt: true,
						hiddenAt: true,
						moderationStatus: true,
					},
				},
			},
		});

		const queryVector = toTextVector({ text: params.query.trim() });
		const scoreById = new Map<string, number>();
		for (const item of embeddings) {
			if (
				!includeHidden &&
				(item.post.deletedAt ||
					item.post.hiddenAt ||
					item.post.moderationStatus === "rejected")
			) {
				continue;
			}

			const score = cosineSimilarity({ left: queryVector, right: item.vector });
			const current = scoreById.get(item.postId);
			if (current === undefined || score > current) {
				scoreById.set(item.postId, score);
			}
		}

		const postById = new Map(visible.map((row) => [row.id, row]));
		search = [...scoreById.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([postId, score]) => {
				const row = postById.get(postId);
				if (!row) {
					return null;
				}
				return {
					post: mapPost({ row }),
					score: Number(score.toFixed(6)),
				};
			})
			.filter((item): item is { post: CommunityPost; score: number } =>
				Boolean(item),
			);
	}

	return {
		status: "ok",
		viewerRole,
		posts: visible.map((row) => mapPost({ row })),
		search,
	};
}

export async function createPost(params: {
	user: CommunityUser | null;
	text: string;
	parentPostId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const status = await getSetupStatus();
	if (!status.isSetup || !status.instance) {
		return { ok: false, error: "Setup not completed" };
	}

	const canPost = await ensureCanPost({
		instanceId: status.instance.id,
		user: params.user,
	});
	if (!canPost || !params.user) {
		return { ok: false, error: "Sign in and approved membership required" };
	}

	const text = params.text.trim();
	if (!text) {
		return { ok: false, error: "Text post must include body text" };
	}

	const db = getDb();

	if (params.parentPostId) {
		const parent = await db.post.findUnique({
			where: { id: params.parentPostId },
			select: {
				id: true,
				instanceId: true,
				deletedAt: true,
				authorId: true,
			},
		});

		if (
			!parent ||
			parent.instanceId !== status.instance.id ||
			parent.deletedAt
		) {
			return { ok: false, error: "Parent post not found" };
		}
	}

	const now = new Date();
	const moderationStatus = text.toLowerCase().includes("illegal")
		? "rejected"
		: text.toLowerCase().includes("spam") || text.toLowerCase().includes("scam")
			? "flagged"
			: "approved";

	const created = await db.post.create({
		data: {
			id: randomUUID(),
			instanceId: status.instance.id,
			authorId: params.user.hubUserId ?? params.user.id,
			authorType: "user",
			groupId: null,
			parentPostId: params.parentPostId ?? null,
			contentType: "text",
			bodyText: text,
			moderationStatus,
			hiddenAt: null,
			deletedAt: null,
			createdAt: now,
			updatedAt: now,
		},
	});

	await db.postEmbedding.create({
		data: {
			id: randomUUID(),
			postId: created.id,
			sourceType: "text",
			modelName: "local-deterministic-embedding",
			vector: toTextVector({ text }),
			summaryText: text,
			createdAt: new Date(),
		},
	});

	await db.moderationDecision.create({
		data: {
			id: randomUUID(),
			postId: created.id,
			status: moderationStatus,
			reason:
				moderationStatus === "approved"
					? "automated-approval"
					: "automated-policy-hit",
			actorType: "ai",
			actorId: null,
			modelName: "local-rule-moderation",
			createdAt: new Date(),
		},
	});

	const mentionEmails = extractMentionEmails({ text });
	const notifiedHubUsers = new Set<string>();
	if (mentionEmails.length > 0) {
		const mentionedUsers = await db.$queryRaw<
			Array<{ local_id: string; hub_user_id: string | null; email: string }>
		>(
			Prisma.sql`SELECT u.id AS local_id,
				a."accountId" AS hub_user_id,
				u.email
			FROM "user" u
			LEFT JOIN "account" a ON a."userId" = u.id AND a."providerId" = 'hub'
			WHERE u.email IN (${Prisma.join(mentionEmails)})`,
		);

		for (const user of mentionedUsers) {
			const resolvedHubUserId = user.hub_user_id ?? user.local_id;
			if (
				user.local_id === params.user.id ||
				resolvedHubUserId === (params.user.hubUserId ?? params.user.id)
			) {
				continue;
			}
			notifiedHubUsers.add(resolvedHubUserId);
			await db.notificationOutbox.create({
				data: {
					id: randomUUID(),
					recipientHubUserId: resolvedHubUserId,
					type: "mention",
					title: "You were mentioned in a post",
					body: text,
					targetUrl: `/feed#post-${created.id}`,
					instanceBaseUrl: getServerEnv().HUB_INSTANCE_BASE_URL,
					status: "pending",
					attempts: 0,
					maxAttempts: 8,
					lastError: null,
					nextAttemptAt: new Date(),
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			});
		}
	}

	if (params.parentPostId) {
		const parent = await db.post.findUnique({
			where: { id: params.parentPostId },
			select: { authorId: true },
		});

		const postingAuthorId = params.user.hubUserId ?? params.user.id;
		if (parent && parent.authorId !== postingAuthorId) {
			if (!notifiedHubUsers.has(parent.authorId)) {
				await db.notificationOutbox.create({
					data: {
						id: randomUUID(),
						recipientHubUserId: parent.authorId,
						type: "reply",
						title: "New reply to your post",
						body: text,
						targetUrl: `/feed#post-${created.id}`,
						instanceBaseUrl: getServerEnv().HUB_INSTANCE_BASE_URL,
						status: "pending",
						attempts: 0,
						maxAttempts: 8,
						lastError: null,
						nextAttemptAt: new Date(),
						createdAt: new Date(),
						updatedAt: new Date(),
					},
				});
			}

			await processNotificationOutbox({ limit: 10 });
		}
	}

	return { ok: true };
}

export async function moderatePost(params: {
	user: CommunityUser | null;
	postId: string;
	status: "approved" | "rejected" | "flagged";
	hide: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const setup = await getSetupStatus();
	if (!setup.isSetup || !setup.instance) {
		return { ok: false, error: "Setup not completed" };
	}

	const admin = await isAdmin({
		instanceId: setup.instance.id,
		user: params.user,
	});
	if (!admin || !params.user) {
		return { ok: false, error: "Admin access required" };
	}

	const now = new Date();
	const updated = await getDb().post.updateMany({
		where: {
			id: params.postId,
			instanceId: setup.instance.id,
		},
		data: {
			moderationStatus: params.status,
			hiddenAt: params.hide ? now : null,
			updatedAt: now,
		},
	});

	if (updated.count === 0) {
		return { ok: false, error: "Post not found" };
	}

	await getDb().moderationDecision.create({
		data: {
			id: randomUUID(),
			postId: params.postId,
			status: params.status,
			reason: "manual-admin-moderation",
			actorType: "human",
			actorId: params.user.id,
			modelName: null,
			createdAt: now,
		},
	});

	await processNotificationOutbox({ limit: 10 });
	return { ok: true };
}

export async function softDeletePost(params: {
	user: CommunityUser | null;
	postId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const setup = await getSetupStatus();
	if (!setup.isSetup || !setup.instance) {
		return { ok: false, error: "Setup not completed" };
	}

	const admin = await isAdmin({
		instanceId: setup.instance.id,
		user: params.user,
	});
	if (!admin) {
		return { ok: false, error: "Admin access required" };
	}

	const updated = await getDb().post.updateMany({
		where: {
			id: params.postId,
			instanceId: setup.instance.id,
		},
		data: {
			deletedAt: new Date(),
			updatedAt: new Date(),
		},
	});

	if (updated.count === 0) {
		return { ok: false, error: "Post not found" };
	}

	await processNotificationOutbox({ limit: 10 });
	return { ok: true };
}
