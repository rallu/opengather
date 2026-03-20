import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getConfig } from "./config.service.server.ts";
import { getDb } from "./db.server.ts";
import { toTextVector } from "./embedding.service.server.ts";
import {
	getFeedGroupIds,
	getReadableGroupIds,
} from "./group.service.server.ts";
import {
	getGroupMembership,
	resolveGroupRole,
} from "./group-membership.service.server.ts";
import { processNotificationOutbox } from "./jobs.service.server.ts";
import { extractMentionEmails } from "./mentions.server.ts";
import { createNotification } from "./notification.service.server.ts";
import {
	canManageInstance,
	canPostToGroup,
	canPostToInstanceFeed,
	canViewInstanceFeed,
	getInstanceViewerRole,
	type InstanceVisibilityMode,
	resolveViewerRoleFromMembership,
} from "./permissions.server.ts";
import {
	loadPostAssetSummaries,
	type PostAssetSummary,
	preparePostAssetsForCreate,
} from "./post-assets.server.ts";
import {
	loadPostListPage,
	type PostListPage,
	type PostListSortMode,
} from "./post-list.service.server.ts";
import { ensurePostRootIds } from "./post-root.server.ts";
import {
	buildThreadTree,
	MAX_THREAD_DEPTH,
	normalizeThreadDepths,
} from "./post-thread.server.ts";
import { getSetupStatus } from "./setup.service.server.ts";

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
	assets: PostAssetSummary[];
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

export type CreatedPostSummary = {
	id: string;
	parentPostId?: string;
	bodyText?: string;
	assets: PostAssetSummary[];
	group?: {
		id: string;
		name: string;
	};
	moderationStatus: "pending" | "approved" | "rejected" | "flagged";
	isHidden: boolean;
	isDeleted: boolean;
	createdAt: string;
	latestActivityAt: string;
	commentCount: number;
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
		assets?: PostAssetSummary[];
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
		assets: params.row.assets ?? [],
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
			rootPostId: true,
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
	sortMode: PostListSortMode;
	cursor?: string | null;
}): Promise<{
	status:
		| "ok"
		| "not_setup"
		| "requires_registration"
		| "pending_membership"
		| "forbidden";
	viewerRole: "guest" | "member" | "moderator" | "admin";
	page: PostListPage;
}> {
	const status = await getSetupStatus();
	if (!status.isSetup || !status.instance) {
		return {
			status: "not_setup",
			viewerRole: "guest",
			page: {
				items: [],
				hasMore: false,
				sortMode: params.sortMode,
			},
		};
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
			page: {
				items: [],
				hasMore: false,
				sortMode: params.sortMode,
			},
		};
	}

	const includeHidden = await isAdmin({
		instanceId: status.instance.id,
		user: params.user,
	});
	const readableGroupIds = await getFeedGroupIds({
		authUser: params.user
			? {
					id: params.user.id,
					hubUserId: params.user.hubUserId,
				}
			: null,
	});
	const page = await loadPostListPage({
		scope: {
			kind: "community",
			instanceId: status.instance.id,
			readableGroupIds,
		},
		sortMode: params.sortMode,
		cursor: params.cursor,
		includeHidden,
	});

	return {
		status: "ok",
		viewerRole: readAccess.viewerRole,
		page,
	};
}

function findPostInThread(params: {
	posts: CommunityPost[];
	postId: string;
}): CommunityPost | null {
	for (const post of params.posts) {
		if (post.id === params.postId) {
			return post;
		}
		const nestedMatch = findPostInThread({
			posts: post.replies,
			postId: params.postId,
		});
		if (nestedMatch) {
			return nestedMatch;
		}
	}

	return null;
}

export async function loadCommunityPostThread(params: {
	user: CommunityUser | null;
	postId: string;
}): Promise<{
	status:
		| "ok"
		| "not_setup"
		| "requires_registration"
		| "pending_membership"
		| "forbidden"
		| "not_found";
	viewerRole: "guest" | "member" | "moderator" | "admin";
	post: CommunityPost | null;
	canReply: boolean;
}> {
	const status = await getSetupStatus();
	if (!status.isSetup || !status.instance) {
		return {
			status: "not_setup",
			viewerRole: "guest",
			post: null,
			canReply: false,
		};
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
			post: null,
			canReply: false,
		};
	}

	const includeHidden = await isAdmin({
		instanceId: status.instance.id,
		user: params.user,
	});
	await ensurePostRootIds();
	const readableGroupIds = await getReadableGroupIds({
		authUser: params.user
			? {
					id: params.user.id,
					hubUserId: params.user.hubUserId,
				}
			: null,
		instanceViewerRole: readAccess.viewerRole,
	});
	const rows = await getDb().post.findMany({
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
	const assetMap = await loadPostAssetSummaries({
		postIds: visible.map((row) => row.id),
	});
	const threadedPosts = buildThreadTree({
		rows: normalizeThreadDepths({ rows: visible }).map((row) =>
			mapPost({
				row: {
					...row,
					assets: assetMap.get(row.id) ?? [],
				},
			}),
		),
	});
	const post = findPostInThread({
		posts: threadedPosts,
		postId: params.postId,
	});
	const canReply = post
		? post.group
			? canPostToGroup({
					groupRole: resolveGroupRole(
						params.user
							? await getGroupMembership({
									groupId: post.group.id,
									userId: params.user.id,
								})
							: null,
					),
				}).allowed
			: await ensureCanPost({
					instanceId: status.instance.id,
					user: params.user,
				})
		: false;

	return {
		status: post ? "ok" : "not_found",
		viewerRole: readAccess.viewerRole,
		post,
		canReply,
	};
}

export async function createPost(params: {
	user: CommunityUser | null;
	text: string;
	parentPostId?: string;
	groupId?: string;
	uploads?: Array<{
		fieldName: string;
		filename: string;
		mimeType: string;
		byteSize: number;
		tempFilePath: string;
	}>;
}): Promise<
	{ ok: true; createdPost: CreatedPostSummary } | { ok: false; error: string }
> {
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
	await ensurePostRootIds();
	let effectiveGroupId = params.groupId?.trim() || undefined;
	let rootPostId: string | undefined;
	let targetUrl = "/feed";
	let targetGroupName: string | undefined;

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
		rootPostId = parent.rootPostId || parent.id;
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
		targetGroupName = group.name;
	}

	const now = new Date();
	const postId = randomUUID();
	const instanceId = status.instance.id;
	const postingUser = params.user;
	let assetPersistence: Awaited<ReturnType<typeof preparePostAssetsForCreate>>;
	try {
		assetPersistence = await preparePostAssetsForCreate({
			instanceId,
			postId,
			uploads: params.uploads ?? [],
		});
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Asset processing failed",
		};
	}
	const moderationStatus = text.toLowerCase().includes("illegal")
		? "rejected"
		: text.toLowerCase().includes("spam") || text.toLowerCase().includes("scam")
			? "flagged"
			: "approved";

	let created: { id: string } | null = null;
	try {
		created = await db.$transaction(async (trx) => {
			const createdPost = await trx.post.create({
				data: {
					id: postId,
					instanceId,
					authorId: postingUser.hubUserId ?? postingUser.id,
					authorType: "user",
					groupId: effectiveGroupId ?? null,
					rootPostId: rootPostId ?? postId,
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

			await trx.postEmbedding.create({
				data: {
					id: randomUUID(),
					postId: createdPost.id,
					sourceType: "text",
					modelName: "local-deterministic-embedding",
					vector: toTextVector({ text }),
					summaryText: text,
					createdAt: new Date(),
				},
			});

			await trx.moderationDecision.create({
				data: {
					id: randomUUID(),
					postId: createdPost.id,
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

			await assetPersistence.persist(trx);
			return createdPost;
		});
	} catch (error) {
		await assetPersistence.cleanup();
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Failed to create post",
		};
	}
	if (!created) {
		return { ok: false, error: "Failed to create post" };
	}

	const assetMap = await loadPostAssetSummaries({
		postIds: [created.id],
	});
	const createdPost: CreatedPostSummary = {
		id: created.id,
		parentPostId: params.parentPostId ?? undefined,
		bodyText: text,
		assets: assetMap.get(created.id) ?? [],
		group: effectiveGroupId
			? {
					id: effectiveGroupId,
					name: targetGroupName ?? "Group",
				}
			: undefined,
		moderationStatus,
		isHidden: false,
		isDeleted: false,
		createdAt: now.toISOString(),
		latestActivityAt: now.toISOString(),
		commentCount: 0,
	};

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

	return { ok: true, createdPost };
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
