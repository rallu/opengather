import assert from "node:assert/strict";
import test from "node:test";
import { resolveRootPostIds } from "./post-root.server.ts";

test("resolveRootPostIds assigns root ids to roots and descendants", () => {
	const rows = resolveRootPostIds({
		rows: [
			{ id: "root-a", parentPostId: null, rootPostId: "" },
			{ id: "reply-a1", parentPostId: "root-a", rootPostId: "" },
			{ id: "reply-a2", parentPostId: "reply-a1", rootPostId: "" },
			{ id: "root-b", parentPostId: null, rootPostId: "" },
		],
	});

	assert.deepEqual(
		rows.map((row) => ({
			id: row.id,
			rootPostId: row.rootPostId,
		})),
		[
			{ id: "root-a", rootPostId: "root-a" },
			{ id: "reply-a1", rootPostId: "root-a" },
			{ id: "reply-a2", rootPostId: "root-a" },
			{ id: "root-b", rootPostId: "root-b" },
		],
	);
});

test("resolveRootPostIds falls back to self on cycles or missing parents", () => {
	const rows = resolveRootPostIds({
		rows: [
			{ id: "cycle-a", parentPostId: "cycle-b", rootPostId: "" },
			{ id: "cycle-b", parentPostId: "cycle-a", rootPostId: "" },
			{ id: "orphan", parentPostId: "missing", rootPostId: "" },
		],
	});

	const rowById = new Map(rows.map((row) => [row.id, row.rootPostId]));
	assert.ok(["cycle-a", "cycle-b"].includes(rowById.get("cycle-a") ?? ""));
	assert.ok(["cycle-a", "cycle-b"].includes(rowById.get("cycle-b") ?? ""));
	assert.equal(rowById.get("orphan"), "orphan");
});
