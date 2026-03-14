import { randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { getConfig } from "./config.service.server";
import { getDb } from "./db.server";
import { cosineSimilarity, toTextVector } from "./embedding.service.server";
import { getReadableGroupIds } from "./group.service.server";
import {
	getGroupMembership,
	resolveGroupRole,
} from "./group-membership.service.server";
import { processNotificationOutbox } from "./jobs.service.server";
import { extractMentionEmails } from "./mentions.server";
import { createNotification } from "./notification.service.server";
import {
	buildThreadTree,
	MAX_THREAD_DEPTH,
	normalizeThreadDepths,
} from "./post-thread.server";
import {
	canManageInstance,
	canPostToGroup,
	canPostToInstanceFeed,
	canViewInstanceFeed,
	getInstanceViewerRole,
	type InstanceVisibilityMode,
	resolveViewerRoleFromMembership,
} from "./permissions.server";
import { getSetupStatus } from "./setup.service.server";

export type CommunityUser = {
	id: string;
	hubUserId?: string;
	role: "admin" | "member" | "moderator";
};

export type CommunityPost = {
	id: string;
	parentPostId?: string;
	threadDepth: number;
	bodyText?: string;
	group?: {
		id: string;
		name: string;
	};
	moderationStatus: "pending" | "approved" | "rejected" | "flagged";
	isHidden: boolean;
	isDeleted: boolean;
	createdAt: string;
	replies: CommunityPost[];
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

export async function ensureInstanceMembershipForUser(params: {
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
}): Promise<{
	allowed: boolean;
	viewerRole: "guest" | "member" | "moderator" | "admin";
	reason:
		| "allowed"
		| "requires_registration"
		| "membership_required"
		| "pending_membership";
	visibilityMode: InstanceVisibilityMode;
}> {
	const visibilityMode = await getConfig("server_visibility_mode");
	const membership = params.user
		? await getDb().instanceMembership.findFirst({
				where: {
					instanceId: params.instanceId,
					principalId: params.user.id,
					principalType: "user",
				},
				select: {
					role: true,
					approvalStatus: true,
				},
			})
		: null;
	const viewerRole = resolveViewerRoleFromMembership(membership);
	const result = canViewInstanceFeed({
		visibilityMode,
		viewerRole,
		isAuthenticated: Boolean(params.user),
	});

	if (!result.allowed) {
		if (result.reason === "requires_authentication") {
			return {
				allowed: false,
				viewerRole,
				reason: "requires_registration",
				visibilityMode,
			};
		}

		if (membership?.approvalStatus === "pending") {
			return {
				allowed: false,
				viewerRole,
				reason: "pending_membership",
				visibilityMode,
			};
		}
	}

	return {
		allowed: result.allowed,
		viewerRole,
		reason: result.allowed
			? "allowed"
			: result.reason === "requires_authentication"
				? "requires_registration"
				: result.reason,
		visibilityMode,
	};
}

async function ensureCanPost(params: {
	instanceId: string;
	user: CommunityUser | null;
}): Promise<boolean> {
	if (!params.user) {
		return false;
	}
	const role = await getInstanceViewerRole({
		instanceId: params.instanceId,
		userId: params.user.id,
	});
	return canPostToInstanceFeed({ viewerRole: role }).allowed;
}

async function isAdmin(params: {
	instanceId: string;
	user: CommunityUser | null;
}): Promise<boolean> {
	if (!params.user) {
		return false;
	}
	const role = await getInstanceViewerRole({
		instanceId: params.instanceId,
		userId: params.user.id,
	});
	return canManageInstance({ viewerRole: role }).allowed;
}

function mapPost(params: {
	row: {
		id: string;
		parentPostId: string | null;
		threadDepth?: number;
		bodyText: string | null;
		groupId?: string | null;
		moderationStatus: string;
		hiddenAt: Date | string | null;
		deletedAt: Date | string | null;
		createdAt: Date | string;
		group?: {
			id: string;
			name: string;
		} | null;
	};
}): CommunityPost {
	return {
		id: params.row.id,
		parentPostId: params.row.parentPostId ?? undefined,
		threadDepth: params.row.threadDepth ?? 0,
		bodyText: params.row.bodyText ?? undefined,
		group:
			params.row.groupId && params.row.group
				? {
						id: params.row.group.id,
						name: params.row.group.name,
					}
				: undefined,
		moderationStatus: asModerationStatus({
			value: params.row.moderationStatus,
		}),
		isHidden: Boolean(params.row.hiddenAt),
		isDeleted: Boolean(params.row.deletedAt),
		createdAt: toIsoString({ value: params.row.createdAt }),
		replies: [],
	};
}

async function resolveParentPostContext(params: {
	instanceId: string;
	parentPostId: string;
}) {
	const db = getDb();
	const parent = await db.post.findUnique({
		where: { id: params.parentPostId },
		select: {
			id: true,
			instanceId: true,
			groupId: true,
			parentPostId: true,
			deletedAt: true,
			authorId: true,
		},
	});

	if (!parent || parent.instanceId !== params.instanceId || parent.deletedAt) {
		return { ok: false as const, error: "Parent post not found" };
	}

	let threadDepth = 0;
	let currentParentId = parent.parentPostId;
	const visitedIds = new Set([parent.id]);

	while (currentParentId) {
		if (visitedIds.has(currentParentId)) {
			return { ok: false as const, error: "Parent post not found" };
		}
		visitedIds.add(currentParentId);

		const ancestor = await db.post.findUnique({
			where: { id: currentParentId },
			select: {
				id: true,
				instanceId: true,
				parentPostId: true,
			},
		});

		if (!ancestor || ancestor.instanceId !== params.instanceId) {
			return { ok: false as const, error: "Parent post not found" };
		}

		threadDepth += 1;
		currentParentId = ancestor.parentPostId;
	}

	return {
		ok: true as const,
		parent,
		replyDepth: threadDepth + 1,
	};
}

export async function loadCommunity(params: {
	user: CommunityUser | null;
	query?: string;
}): Promise<{
	status:
		| "ok"
		| "not_setup"
		| "requires_registration"
		| "pending_membership"
		| "forbidden";
	viewerRole: "guest" | "member" | "moderator" | "admin";
	posts: CommunityPost[];
	search: Array<{ post: CommunityPost; score: number }>;
}> {
	const status = await getSetupStatus();
	if (!status.isSetup || !status.instance) {
		return { status: "not_setup", viewerRole: "guest", posts: [], search: [] };
	}

	await ensureInstanceMembershipForUser({
		instanceId: status.instance.id,
		approvalMode: status.instance.approvalMode,
		user: params.user,
	});

	const readAccess = await ensureCanRead({
		instanceId: status.instance.id,
		user: params.user,
	});
	if (!readAccess.allowed) {
		return {
			status:
				readAccess.reason === "requires_registration"
					? "requires_registration"
					: readAccess.reason === "pending_membership"
						? "pending_membership"
						: "forbidden",
			viewerRole: readAccess.viewerRole,
			posts: [],
			search: [],
		};
	}

	const db = getDb();
	const includeHidden = await isAdmin({
		instanceId: status.instance.id,
		user: params.user,
	});
	const readableGroupIds = await getReadableGroupIds({
		authUser: params.user
			? {
					id: params.user.id,
					hubUserId: params.user.hubUserId,
				}
			: null,
		instanceViewerRole: readAccess.viewerRole,
	});
	const rows = await db.post.findMany({
		where: {
			instanceId: status.instance.id,
			OR:
				readableGroupIds.length > 0
					? [{ groupId: null }, { groupId: { in: readableGroupIds } }]
					: [{ groupId: null }],
		},
		orderBy: { createdAt: "asc" },
		select: {
			id: true,
			parentPostId: true,
			bodyText: true,
			groupId: true,
			moderationStatus: true,
			hiddenAt: true,
			deletedAt: true,
			createdAt: true,
			group: {
				select: {
					id: true,
					name: true,
				},
			},
		},
	});

	const visible = rows.filter((row) => {
		if (includeHidden) {
			return true;
		}
		return (
			!row.deletedAt && !row.hiddenAt && row.moderationStatus !== "rejected"
		);
	});

	const normalizedVisibleRows = normalizeThreadDepths({ rows: visible });
	const threadedPosts = buildThreadTree({
		rows: normalizedVisibleRows.map((row) => mapPost({ row })),
	});

	let search: Array<{ post: CommunityPost; score: number }> = [];
	if (params.query && params.query.trim().length > 0) {
		const embeddings = await db.postEmbedding.findMany({
			where: {
				sourceType: "text",
				post: {
					instanceId: status.instance.id,
					OR:
						readableGroupIds.length > 0
							? [{ groupId: null }, { groupId: { in: readableGroupIds } }]
							: [{ groupId: null }],
				},
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

		const postById = new Map(
			normalizedVisibleRows.map((row) => [row.id, mapPost({ row })]),
		);
		search = [...scoreById.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([postId, score]) => {
				const post = postById.get(postId);
				if (!post) {
					return null;
				}
				return {
					post,
					score: Number(score.toFixed(6)),
				};
			})
			.filter((item): item is { post: CommunityPost; score: number } =>
				Boolean(item),
			);
	}

	return {
		status: "ok",
		viewerRole: readAccess.viewerRole,
		posts: threadedPosts,
		search,
	};
}

export async function createPost(params: {
	user: CommunityUser | null;
	text: string;
	parentPostId?: string;
	groupId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const status = await getSetupStatus();
	if (!status.isSetup || !status.instance) {
		return { ok: false, error: "Setup not completed" };
	}
	if (!params.user) {
		return { ok: false, error: "Sign in and approved membership required" };
	}

	const text = params.text.trim();
	if (!text) {
		return { ok: false, error: "Text post must include body text" };
	}

	const db = getDb();
	let effectiveGroupId = params.groupId?.trim() || undefined;
	let targetUrl = "/feed";

	if (!effectiveGroupId) {
		const canPost = await ensureCanPost({
			instanceId: status.instance.id,
			user: params.user,
		});
		if (!canPost) {
			return { ok: false, error: "Sign in and approved membership required" };
		}
	}

	if (params.parentPostId) {
		const parentContext = await resolveParentPostContext({
			instanceId: status.instance.id,
			parentPostId: params.parentPostId,
		});
		if (!parentContext.ok) {
			return parentContext;
		}
		const parent = parentContext.parent;

		if (effectiveGroupId && parent.groupId !== effectiveGroupId) {
			return { ok: false, error: "Replies must stay in the same group" };
		}

		if (parentContext.replyDepth > MAX_THREAD_DEPTH) {
			return {
				ok: false,
				error: `Replies can only nest ${MAX_THREAD_DEPTH} levels deep`,
			};
		}

		effectiveGroupId = parent.groupId ?? effectiveGroupId;
	}

	if (effectiveGroupId) {
		const group = await db.communityGroup.findFirst({
			where: {
				id: effectiveGroupId,
				instanceId: status.instance.id,
			},
			select: {
				id: true,
				name: true,
			},
		});
		if (!group) {
			return { ok: false, error: "Group not found" };
		}

		const membership = await getGroupMembership({
			groupId: group.id,
			userId: params.user.id,
		});
		const groupRole = resolveGroupRole(membership);
		if (!canPostToGroup({ groupRole }).allowed) {
			return { ok: false, error: "Group membership required" };
		}

		targetUrl = `/groups/${group.id}`;
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
			groupId: effectiveGroupId ?? null,
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
	const notifiedLocalUsers = new Set<string>();
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
			if (user.local_id === params.user.id) {
				continue;
			}
			notifiedLocalUsers.add(user.local_id);
			await createNotification({
				userId: user.local_id,
				kind: "mention",
				title: "You were mentioned in a post",
				body: text,
				targetUrl: `${targetUrl}#post-${created.id}`,
				relatedEntityId: created.id,
				payload: {
					actorUserId: params.user.id,
					postId: created.id,
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
			const localParentAuthor = await db.user.findFirst({
				where: {
					OR: [
						{ id: parent.authorId },
						{
							accounts: {
								some: {
									providerId: "hub",
									accountId: parent.authorId,
								},
							},
						},
					],
				},
				select: { id: true },
			});

			if (
				localParentAuthor &&
				localParentAuthor.id !== params.user.id &&
				!notifiedLocalUsers.has(localParentAuthor.id)
			) {
				await createNotification({
					userId: localParentAuthor.id,
					kind: "reply_to_post",
					title: "New reply to your post",
					body: text,
					targetUrl: `${targetUrl}#post-${created.id}`,
					relatedEntityId: created.id,
					payload: {
						actorUserId: params.user.id,
						postId: created.id,
						parentPostId: params.parentPostId,
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
