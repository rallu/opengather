import {
	Prisma,
	type PrismaClient,
} from "../../app/generated/prisma-node/client.ts";
import { MAX_THREAD_DEPTH } from "../../app/server/post-thread.server.ts";
import {
	REPLY_TEXT,
	ROOT_POST_TEXT,
	ROOT_REPLY_COUNTS,
	replyPostId,
	rootPostId,
	SEED_USERS,
} from "./data.ts";

const MAX_SEED_CHILDREN_PER_POST = 3;

type ReplyInsertPlan = {
	replyId: string;
	parentId: string;
	threadDepth: number;
};

function buildReplyInsertPlan(params: {
	rootId: string;
	rootIndex: number;
	replyCount: number;
}): ReplyInsertPlan[] {
	const plan: ReplyInsertPlan[] = [];
	const levels: string[][] = [[params.rootId]];
	let nextReplyIndex = 0;
	let remainingReplies = params.replyCount;

	for (
		let threadDepth = 1;
		threadDepth <= MAX_THREAD_DEPTH && remainingReplies > 0;
		threadDepth += 1
	) {
		const parents = levels[threadDepth - 1] ?? [];
		if (parents.length === 0) {
			break;
		}

		const levelReplyCount = Math.min(
			remainingReplies,
			parents.length * MAX_SEED_CHILDREN_PER_POST,
		);
		const levelReplyIds: string[] = [];

		for (let levelIndex = 0; levelIndex < levelReplyCount; levelIndex += 1) {
			const replyId = replyPostId(params.rootIndex, nextReplyIndex);
			const parentId = parents[levelIndex % parents.length];
			if (!parentId) {
				throw new Error("Missing parent while building reply insert plan");
			}

			plan.push({
				replyId,
				parentId,
				threadDepth,
			});
			levelReplyIds.push(replyId);
			nextReplyIndex += 1;
		}

		levels[threadDepth] = levelReplyIds;
		remainingReplies -= levelReplyCount;
	}

	if (remainingReplies > 0) {
		throw new Error(
			`Reply count ${params.replyCount} exceeds supported seed thread capacity`,
		);
	}

	return plan;
}

export async function seedPosts(db: PrismaClient, instanceId: string) {
	const now = Date.now();

	await db.$transaction(async (trx) => {
		for (let rootIndex = 0; rootIndex < ROOT_POST_TEXT.length; rootIndex += 1) {
			const rootId = rootPostId(rootIndex);
			await trx.post.deleteMany({
				where: {
					id: {
						startsWith: `seed-reply-${rootIndex + 1}-`,
					},
				},
			});
			await trx.post.deleteMany({
				where: {
					id: rootId,
				},
			});

			const rootAuthor = SEED_USERS[rootIndex % SEED_USERS.length];
			if (!rootAuthor) {
				throw new Error("Missing root author while seeding posts");
			}
			const rootCreatedAt = new Date(
				now - (ROOT_POST_TEXT.length - rootIndex) * 60_000,
			);

			await trx.$executeRaw(
				Prisma.sql`
					INSERT INTO post (
						id,
						instance_id,
						author_id,
						author_type,
						group_id,
						root_post_id,
						parent_post_id,
						content_type,
						body_text,
						moderation_status,
						hidden_at,
						deleted_at,
						created_at,
						updated_at
					)
					VALUES (
						${rootId},
						${instanceId},
						${rootAuthor.id},
						${"user"},
						${null},
						${rootId},
						${null},
						${"text"},
						${ROOT_POST_TEXT[rootIndex]},
						${"approved"},
						${null},
						${null},
						${rootCreatedAt},
						${rootCreatedAt}
					)
				`,
			);

			const replyCount = ROOT_REPLY_COUNTS[rootIndex] ?? 0;
			const replyPlan = buildReplyInsertPlan({
				rootId,
				rootIndex,
				replyCount,
			});
			for (let replyIndex = 0; replyIndex < replyPlan.length; replyIndex += 1) {
				const reply = replyPlan[replyIndex];
				if (!reply) {
					throw new Error("Missing reply plan entry while seeding replies");
				}
				const replyAuthor =
					SEED_USERS[(rootIndex + replyIndex + 1) % SEED_USERS.length];
				if (!replyAuthor) {
					throw new Error("Missing reply author while seeding replies");
				}
				const replyCreatedAt = new Date(
					rootCreatedAt.getTime() + (replyIndex + 1) * 45_000,
				);

				await trx.$executeRaw(
					Prisma.sql`
						INSERT INTO post (
							id,
							instance_id,
							author_id,
							author_type,
							group_id,
							root_post_id,
							parent_post_id,
							content_type,
							body_text,
							moderation_status,
							hidden_at,
							deleted_at,
							created_at,
							updated_at
						)
						VALUES (
							${reply.replyId},
							${instanceId},
							${replyAuthor.id},
							${"user"},
							${null},
							${rootId},
							${reply.parentId},
							${"text"},
							${REPLY_TEXT[replyIndex % REPLY_TEXT.length]},
							${"approved"},
							${null},
							${null},
							${replyCreatedAt},
							${replyCreatedAt}
						)
					`,
				);
			}
		}
	});
}
