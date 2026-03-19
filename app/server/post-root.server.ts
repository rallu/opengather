import { getDb } from "./db.server.ts";

type PostRootRow = {
	id: string;
	parentPostId?: string | null;
	rootPostId?: string | null;
};

function toPostId(value?: string | null): string | undefined {
	const normalized = value?.trim();
	return normalized ? normalized : undefined;
}

export function resolveRootPostIds<T extends PostRootRow>(params: {
	rows: T[];
}): Array<T & { parentPostId?: string; rootPostId: string }> {
	const rowById = new Map(
		params.rows.map((row) => [
			row.id,
			{
				...row,
				parentPostId: toPostId(row.parentPostId),
				rootPostId: toPostId(row.rootPostId),
			},
		]),
	);
	const rootById = new Map<string, string>();

	function resolveRootId(rowId: string, stack: Set<string>): string {
		const memoized = rootById.get(rowId);
		if (memoized) {
			return memoized;
		}

		const row = rowById.get(rowId);
		if (!row) {
			rootById.set(rowId, rowId);
			return rowId;
		}

		if (row.rootPostId) {
			rootById.set(rowId, row.rootPostId);
			return row.rootPostId;
		}

		if (!row.parentPostId || row.parentPostId === row.id || stack.has(row.id)) {
			rootById.set(row.id, row.id);
			return row.id;
		}
		if (stack.has(row.parentPostId)) {
			rootById.set(row.id, row.id);
			return row.id;
		}

		const parent = rowById.get(row.parentPostId);
		if (!parent) {
			rootById.set(row.id, row.id);
			return row.id;
		}

		const nextStack = new Set(stack);
		nextStack.add(row.id);
		const rootId = resolveRootId(parent.id, nextStack);
		rootById.set(row.id, rootId);
		return rootId;
	}

	return params.rows.map((row) => ({
		...row,
		parentPostId: toPostId(row.parentPostId),
		rootPostId: resolveRootId(row.id, new Set()),
	}));
}

export async function ensurePostRootIds(): Promise<void> {
	const db = getDb();
	const missingRootCount = await db.post.count({
		where: {
			rootPostId: "",
		},
	});
	if (missingRootCount === 0) {
		return;
	}

	const rows = await db.post.findMany({
		select: {
			id: true,
			parentPostId: true,
			rootPostId: true,
		},
	});
	const resolvedRows = resolveRootPostIds({ rows });
	const originalRowById = new Map(
		rows.map((row) => [row.id, toPostId(row.rootPostId)]),
	);
	const updates = resolvedRows.filter(
		(row) => originalRowById.get(row.id) !== row.rootPostId,
	);

	if (updates.length === 0) {
		return;
	}

	await db.$transaction(
		updates.map((row) =>
			db.post.update({
				where: { id: row.id },
				data: { rootPostId: row.rootPostId },
			}),
		),
	);
}
