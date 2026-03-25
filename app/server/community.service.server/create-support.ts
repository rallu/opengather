import { getDb } from "../db.server.ts";
import { MAX_THREAD_DEPTH } from "../post-thread.server.ts";

export async function resolveParentPostContext(params: {
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

	if (threadDepth + 1 > MAX_THREAD_DEPTH) {
		return {
			ok: false as const,
			error: `Replies can only nest ${MAX_THREAD_DEPTH} levels deep`,
		};
	}

	return {
		ok: true as const,
		parent,
		replyDepth: threadDepth + 1,
	};
}
