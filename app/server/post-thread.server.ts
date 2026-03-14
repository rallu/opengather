export const MAX_THREAD_DEPTH = 3;

type ParentThreadRow = {
	id: string;
	parentPostId?: string | null;
};

export type ThreadedPost = {
	id: string;
	parentPostId?: string;
	threadDepth: number;
};

export type ThreadedPostNode<T extends ThreadedPost> = T & {
	replies: Array<ThreadedPostNode<T>>;
};

function toParentPostId(parentPostId?: string | null): string | undefined {
	return parentPostId ?? undefined;
}

export function normalizeThreadDepths<T extends ParentThreadRow>(params: {
	rows: T[];
}): Array<T & { parentPostId?: string; threadDepth: number }> {
	const rowById = new Map(params.rows.map((row) => [row.id, row]));
	const depthById = new Map<string, number>();

	function resolveDepth(row: T, stack: Set<string>): number {
		const memoized = depthById.get(row.id);
		if (memoized !== undefined) {
			return memoized;
		}

		const parentPostId = toParentPostId(row.parentPostId);
		if (!parentPostId || parentPostId === row.id) {
			depthById.set(row.id, 0);
			return 0;
		}

		const parent = rowById.get(parentPostId);
		if (!parent || stack.has(parentPostId)) {
			depthById.set(row.id, 0);
			return 0;
		}

		const nextStack = new Set(stack);
		nextStack.add(row.id);
		const depth = resolveDepth(parent, nextStack) + 1;
		depthById.set(row.id, depth);
		return depth;
	}

	return params.rows.map((row) => ({
		...row,
		parentPostId: toParentPostId(row.parentPostId),
		threadDepth: resolveDepth(row, new Set()),
	}));
}

export function buildThreadTree<T extends ThreadedPost>(params: {
	rows: T[];
}): Array<ThreadedPostNode<T>> {
	const nodeById = new Map<string, ThreadedPostNode<T>>(
		params.rows.map((row) => [row.id, { ...row, replies: [] }]),
	);
	const roots: Array<ThreadedPostNode<T>> = [];

	for (const row of params.rows) {
		const node = nodeById.get(row.id);
		if (!node) {
			continue;
		}

		const parent = row.parentPostId ? nodeById.get(row.parentPostId) : undefined;
		if (!parent || parent.threadDepth + 1 !== row.threadDepth) {
			roots.push(node);
			continue;
		}

		parent.replies.push(node);
	}

	return roots;
}

export function canReplyAtThreadDepth(threadDepth: number): boolean {
	return threadDepth < MAX_THREAD_DEPTH;
}
