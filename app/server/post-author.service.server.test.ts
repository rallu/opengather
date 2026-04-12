import assert from "node:assert/strict";
import test from "node:test";
import { loadPostAuthorSummaryMap } from "./post-author.service.server.ts";

test("loadPostAuthorSummaryMap resolves mixed user and agent authors", async () => {
	const summaries = await loadPostAuthorSummaryMap({
		authors: [
			{ id: "user-1", type: "user" },
			{ id: "hub-user-1", type: "user" },
			{ id: "agent-1", type: "agent" },
		],
		db: {
			user: {
				findMany: async () => [
					{
						id: "user-1",
						name: "Aino Member",
						image: "https://example.com/aino.png",
						imageOverride: null,
						accounts: [{ accountId: "hub-user-1" }],
					},
				],
			},
			agent: {
				findMany: async () => [
					{
						id: "agent-1",
						displayName: "Codex",
						displayLabel: "Codex agent",
					},
				],
			},
		},
	});

	assert.deepEqual(summaries.get("user-1"), {
		id: "user-1",
		name: "Aino Member",
		kind: "user",
		imageSrc: "https://example.com/aino.png",
		profilePath: "/profiles/user-1",
	});
	assert.deepEqual(summaries.get("hub-user-1"), {
		id: "user-1",
		name: "Aino Member",
		kind: "user",
		imageSrc: "https://example.com/aino.png",
		profilePath: "/profiles/user-1",
	});
	assert.deepEqual(summaries.get("agent-1"), {
		id: "agent-1",
		name: "Codex agent",
		kind: "agent",
	});
});

test("loadPostAuthorSummaryMap falls back for unknown agent authors", async () => {
	const summaries = await loadPostAuthorSummaryMap({
		authors: [{ id: "missing-agent", type: "agent" }],
		db: {
			user: {
				findMany: async () => [],
			},
			agent: {
				findMany: async () => [],
			},
		},
	});

	assert.deepEqual(summaries.get("missing-agent"), {
		id: "missing-agent",
		name: "Agent",
		kind: "agent",
	});
});
