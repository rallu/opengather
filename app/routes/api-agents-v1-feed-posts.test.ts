import assert from "node:assert/strict";
import test from "node:test";
import { createAgentFeedPost } from "./api-agents-v1-feed-posts.server.ts";

test("createAgentFeedPost validates JSON body", async () => {
	const response = await createAgentFeedPost({
		request: new Request("http://localhost/api/agents/v1/feed/posts", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-request-id": "req-feed-validation",
			},
			body: JSON.stringify({}),
		}),
		authenticate: async () => ({
			ok: true,
			agent: {
				id: "agent-1",
				instanceId: "instance-1",
				createdByUserId: null,
				displayName: "Codex",
				displayLabel: null,
				description: null,
				role: "assistant",
				isEnabled: true,
				lastUsedAt: null,
				deletedAt: null,
				grants: [],
			},
			subjectContext: {
				subject: { kind: "agent", agentId: "agent-1" },
				isAuthenticated: true,
				instanceRole: "member",
				groupRoles: new Map(),
				scopes: new Set(),
			},
			instanceRole: "member",
			groupRoles: new Map(),
		}),
		db: {
			$transaction: async (callback) =>
				callback({
					post: { create: async () => null },
					postEmbedding: { create: async () => null },
					moderationDecision: { create: async () => null },
				}),
		},
	});

	assert.equal(response.status, 400);
	assert.equal(response.headers.get("x-request-id"), "req-feed-validation");
	assert.deepEqual(await response.json(), {
		ok: false,
		meta: {
			requestId: "req-feed-validation",
		},
		error: {
			code: "validation_error",
			message: "bodyText is required.",
		},
	});
});

test("createAgentFeedPost rejects forbidden instance-feed posts", async () => {
	const response = await createAgentFeedPost({
		request: new Request("http://localhost/api/agents/v1/feed/posts", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-request-id": "req-feed-forbidden",
			},
			body: JSON.stringify({ bodyText: "Hello" }),
		}),
		authenticate: async () => ({
			ok: true,
			agent: {
				id: "agent-1",
				instanceId: "instance-1",
				createdByUserId: null,
				displayName: "Codex",
				displayLabel: null,
				description: null,
				role: "assistant",
				isEnabled: true,
				lastUsedAt: null,
				deletedAt: null,
				grants: [],
			},
			subjectContext: {
				subject: { kind: "agent", agentId: "agent-1" },
				isAuthenticated: true,
				instanceRole: "guest",
				groupRoles: new Map(),
				scopes: new Set(["instance.feed.post"]),
			},
			instanceRole: "guest",
			groupRoles: new Map(),
		}),
		db: {
			$transaction: async (callback) =>
				callback({
					post: { create: async () => null },
					postEmbedding: { create: async () => null },
					moderationDecision: { create: async () => null },
				}),
		},
	});

	assert.equal(response.status, 403);
	assert.equal(response.headers.get("x-request-id"), "req-feed-forbidden");
	assert.deepEqual(await response.json(), {
		ok: false,
		meta: {
			requestId: "req-feed-forbidden",
		},
		error: {
			code: "forbidden",
			message: "Agent cannot post to the instance feed.",
			details: {
				reason: "membership_required",
			},
		},
	});
});

test("createAgentFeedPost creates an auditable agent-authored instance-feed post", async () => {
	const created: Array<{ kind: string; data: Record<string, unknown> }> = [];
	const audits: unknown[] = [];
	const ids = ["post-1", "embedding-1", "moderation-1"];
	const response = await createAgentFeedPost({
		request: new Request("http://localhost/api/agents/v1/feed/posts", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-request-id": "req-feed-success",
			},
			body: JSON.stringify({ bodyText: "Hello from Codex" }),
		}),
		now: new Date("2026-04-06T12:00:00.000Z"),
		generateId: () => ids.shift() ?? "extra-id",
		writeAuditLog: async (params) => {
			audits.push(params);
		},
		authenticate: async () => ({
			ok: true,
			agent: {
				id: "agent-1",
				instanceId: "instance-1",
				createdByUserId: "user-1",
				displayName: "Codex",
				displayLabel: "Codex agent",
				description: null,
				role: "assistant",
				isEnabled: true,
				lastUsedAt: null,
				deletedAt: null,
				grants: [
					{
						id: "grant-1",
						resourceType: "instance",
						resourceId: "instance-1",
						scope: "instance.feed.post",
					},
				],
			},
			subjectContext: {
				subject: { kind: "agent", agentId: "agent-1" },
				isAuthenticated: true,
				instanceRole: "member",
				groupRoles: new Map(),
				scopes: new Set(["instance.feed.post"]),
			},
			instanceRole: "member",
			groupRoles: new Map(),
		}),
		db: {
			$transaction: async (callback) =>
				callback({
					post: {
						create: async (args) => {
							created.push({ kind: "post", data: args.data });
							return args;
						},
					},
					postEmbedding: {
						create: async (args) => {
							created.push({ kind: "embedding", data: args.data });
							return args;
						},
					},
					moderationDecision: {
						create: async (args) => {
							created.push({ kind: "moderation", data: args.data });
							return args;
						},
					},
				}),
		},
	});

	assert.equal(response.status, 201);
	assert.equal(response.headers.get("x-request-id"), "req-feed-success");
	assert.deepEqual(await response.json(), {
		ok: true,
		meta: {
			requestId: "req-feed-success",
		},
		data: {
			post: {
				id: "post-1",
				bodyText: "Hello from Codex",
				moderationStatus: "approved",
				createdAt: "2026-04-06T12:00:00.000Z",
				author: {
					type: "agent",
					id: "agent-1",
					displayName: "Codex agent",
				},
			},
		},
	});
	assert.equal(created[0]?.kind, "post");
	assert.equal(created[0]?.data.authorType, "agent");
	assert.equal(created[0]?.data.groupId, null);
	assert.equal(audits.length, 1);
	const [audit] = audits as Array<{
		action: string;
		actor: { type: string; id?: string };
		resourceType: string;
		resourceId: string;
		request: Request;
		payload: Record<string, unknown>;
	}>;
	assert.equal(audit.action, "agent.post.create");
	assert.deepEqual(audit.actor, { type: "agent", id: "agent-1" });
	assert.equal(audit.resourceType, "post");
	assert.equal(audit.resourceId, "post-1");
	assert.equal(
		new URL(audit.request.url).pathname,
		"/api/agents/v1/feed/posts",
	);
	assert.deepEqual(audit.payload, {
		requestId: "req-feed-success",
		scope: "instance.feed.post",
		moderationStatus: "approved",
	});
});
