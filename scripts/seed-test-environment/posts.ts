import type { PrismaClient } from "../../app/generated/prisma-node/client.ts";
import {
	REPLY_TEXT,
	ROOT_POST_TEXT,
	ROOT_REPLY_COUNTS,
	replyPostId,
	rootPostId,
	SEED_USERS,
} from "./data";

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

			await trx.post.create({
				data: {
					id: rootId,
					instanceId,
					authorId: rootAuthor.id,
					authorType: "user",
					groupId: null,
					rootPostId: rootId,
					parentPostId: null,
					contentType: "text",
					bodyText: ROOT_POST_TEXT[rootIndex],
					moderationStatus: "approved",
					hiddenAt: null,
					deletedAt: null,
					createdAt: rootCreatedAt,
					updatedAt: rootCreatedAt,
				},
			});

			const replyCount = ROOT_REPLY_COUNTS[rootIndex] ?? 0;
			let parentId = rootId;
			for (let replyIndex = 0; replyIndex < replyCount; replyIndex += 1) {
				const replyId = replyPostId(rootIndex, replyIndex);
				const replyAuthor =
					SEED_USERS[(rootIndex + replyIndex + 1) % SEED_USERS.length];
				if (!replyAuthor) {
					throw new Error("Missing reply author while seeding replies");
				}
				const replyCreatedAt = new Date(
					rootCreatedAt.getTime() + (replyIndex + 1) * 45_000,
				);

				await trx.post.create({
					data: {
						id: replyId,
						instanceId,
						authorId: replyAuthor.id,
						authorType: "user",
						groupId: null,
						rootPostId: rootId,
						parentPostId: parentId,
						contentType: "text",
						bodyText: REPLY_TEXT[replyIndex % REPLY_TEXT.length],
						moderationStatus: "approved",
						hiddenAt: null,
						deletedAt: null,
						createdAt: replyCreatedAt,
						updatedAt: replyCreatedAt,
					},
				});

				parentId = replyId;
			}
		}
	});
}
