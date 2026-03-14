import assert from "node:assert/strict";
import test from "node:test";
import {
	MAX_THREAD_DEPTH,
	buildThreadTree,
	canReplyAtThreadDepth,
	normalizeThreadDepths,
} from "./post-thread.server.ts";

test("normalizeThreadDepths derives depth from the parent chain", () => {
	const rows = normalizeThreadDepths({
		rows: [
			{ id: "root", parentPostId: null },
			{ id: "reply-1", parentPostId: "root" },
			{ id: "reply-2", parentPostId: "reply-1" },
			{ id: "reply-3", parentPostId: "reply-2" },
		],
	});

	assert.deepEqual(
		rows.map((row) => ({
			id: row.id,
			threadDepth: row.threadDepth,
		})),
		[
			{ id: "root", threadDepth: 0 },
			{ id: "reply-1", threadDepth: 1 },
			{ id: "reply-2", threadDepth: 2 },
			{ id: "reply-3", threadDepth: 3 },
		],
	);
});

test("buildThreadTree nests replies under their parent", () => {
	const rows = buildThreadTree({
		rows: [
			{ id: "root", threadDepth: 0 },
			{ id: "reply-1", parentPostId: "root", threadDepth: 1 },
			{ id: "reply-2", parentPostId: "reply-1", threadDepth: 2 },
			{ id: "other-root", threadDepth: 0 },
		],
	});

	assert.equal(rows.length, 2);
	assert.equal(rows[0]?.id, "root");
	assert.equal(rows[0]?.replies[0]?.id, "reply-1");
	assert.equal(rows[0]?.replies[0]?.replies[0]?.id, "reply-2");
	assert.equal(rows[1]?.id, "other-root");
});

test("canReplyAtThreadDepth caps replies at three nested levels", () => {
	assert.equal(MAX_THREAD_DEPTH, 3);
	assert.equal(canReplyAtThreadDepth(0), true);
	assert.equal(canReplyAtThreadDepth(2), true);
	assert.equal(canReplyAtThreadDepth(3), false);
});
