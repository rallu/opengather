import assert from "node:assert/strict";
import test from "node:test";
import { createAgentGroupPost } from "./api-agents-v1-groups-group-posts.ts";

test("createAgentGroupPost validates JSON body", async () => {
	const response = await createAgentGroupPost({
		request: new Request(
			"http://localhost/api/agents/v1/groups/group-1/posts",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-request-id": "req-post-validation",
				},
				body: JSON.stringify({}),
			},
		),
		groupId: "group-1",
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
			communityGroup: {
				findFirst: async () => null,
			},
			$transaction: async (callback) =>
				callback({
					post: { create: async () => null },
					postEmbedding: { create: async () => null },
					moderationDecision: { create: async () => null },
				}),
		},
	});

	assert.equal(response.status, 400);
	assert.equal(response.headers.get("x-request-id"), "req-post-validation");
	assert.deepEqual(await response.json(), {
		ok: false,
		meta: {
			requestId: "req-post-validation",
		},
		error: {
			code: "validation_error",
			message: "bodyText is required.",
		},
	});
});

test("createAgentGroupPost rejects forbidden agent posts", async () => {
	const response = await createAgentGroupPost({
		request: new Request(
			"http://localhost/api/agents/v1/groups/group-1/posts",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-request-id": "req-post-forbidden",
				},
				body: JSON.stringify({ bodyText: "Hello" }),
			},
		),
		groupId: "group-1",
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
				scopes: new Set(["group.post"]),
			},
			instanceRole: "member",
			groupRoles: new Map(),
		}),
		db: {
			communityGroup: {
				findFirst: async () => ({
					id: "group-1",
					name: "Team",
					visibilityMode: "group_members",
				}),
			},
			$transaction: async (callback) =>
				callback({
					post: { create: async () => null },
					postEmbedding: { create: async () => null },
					moderationDecision: { create: async () => null },
				}),
		},
	});

	assert.equal(response.status, 403);
	assert.equal(response.headers.get("x-request-id"), "req-post-forbidden");
	assert.deepEqual(await response.json(), {
		ok: false,
		meta: {
			requestId: "req-post-forbidden",
		},
		error: {
			code: "forbidden",
			message: "Agent cannot post to this group.",
			details: {
				reason: "group_membership_required",
			},
		},
	});
});

test("createAgentGroupPost creates an auditable agent-authored group post", async () => {
	const created: Array<{ kind: string; data: Record<string, unknown> }> = [];
	const audits: unknown[] = [];
	const ids = ["post-1", "embedding-1", "moderation-1"];
	const response = await createAgentGroupPost({
		request: new Request(
			"http://localhost/api/agents/v1/groups/group-1/posts",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-request-id": "req-post-success",
				},
				body: JSON.stringify({ bodyText: "Hello from Codex" }),
			},
		),
		groupId: "group-1",
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
						resourceType: "group",
						resourceId: "group-1",
						scope: "group.post",
					},
				],
			},
			subjectContext: {
				subject: { kind: "agent", agentId: "agent-1" },
				isAuthenticated: true,
				instanceRole: "member",
				groupRoles: new Map([["group-1", "member"]]),
				scopes: new Set(["group.post"]),
			},
			instanceRole: "member",
			groupRoles: new Map([["group-1", "member"]]),
		}),
		db: {
			communityGroup: {
				findFirst: async () => ({
					id: "group-1",
					name: "Team",
					visibilityMode: "group_members",
				}),
			},
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
	assert.equal(response.headers.get("x-request-id"), "req-post-success");
	assert.deepEqual(await response.json(), {
		ok: true,
		meta: {
			requestId: "req-post-success",
		},
		data: {
			post: {
				id: "post-1",
				groupId: "group-1",
				groupName: "Team",
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
	assert.equal(created[0]?.data.authorId, "agent-1");
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
	assert.equal(audit.request.method, "POST");
	assert.equal(
		new URL(audit.request.url).pathname,
		"/api/agents/v1/groups/group-1/posts",
	);
	assert.deepEqual(audit.payload, {
		requestId: "req-post-success",
		scope: "group.post",
		groupId: "group-1",
		moderationStatus: "approved",
	});
});

test("createAgentGroupPost returns 429 before writes when the agent write bucket is exhausted", async () => {
	let transactionCalled = false;
	const response = await createAgentGroupPost({
		request: new Request(
			"http://localhost/api/agents/v1/groups/group-1/posts",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-request-id": "req-post-rate-limit",
				},
				body: JSON.stringify({ bodyText: "Hello from Codex" }),
			},
		),
		groupId: "group-1",
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
						resourceType: "group",
						resourceId: "group-1",
						scope: "group.post",
					},
				],
			},
			subjectContext: {
				subject: { kind: "agent", agentId: "agent-1" },
				isAuthenticated: true,
				instanceRole: "member",
				groupRoles: new Map([["group-1", "member"]]),
				scopes: new Set(["group.post"]),
			},
			instanceRole: "member",
			groupRoles: new Map([["group-1", "member"]]),
		}),
		rateLimit: () => ({
			allowed: false,
			limit: 1,
			remaining: 0,
			resetAtMs: Date.UTC(2026, 3, 6, 12, 1, 0),
			retryAfterSeconds: 60,
		}),
		db: {
			communityGroup: {
				findFirst: async () => ({
					id: "group-1",
					name: "Team",
					visibilityMode: "group_members",
				}),
			},
			$transaction: async (callback) => {
				transactionCalled = true;
				return callback({
					post: { create: async () => null },
					postEmbedding: { create: async () => null },
					moderationDecision: { create: async () => null },
				});
			},
		},
		writeAuditLog: async () => {
			throw new Error("writeAuditLog should not be called when rate limited");
		},
	});

	assert.equal(response.status, 429);
	assert.equal(response.headers.get("x-request-id"), "req-post-rate-limit");
	assert.equal(response.headers.get("X-RateLimit-Limit"), "1");
	assert.equal(response.headers.get("Retry-After"), "60");
	assert.equal(transactionCalled, false);
	assert.deepEqual(await response.json(), {
		ok: false,
		meta: {
			requestId: "req-post-rate-limit",
		},
		error: {
			code: "rate_limited",
			message: "Too many agent API requests.",
			details: {
				retryAfterSeconds: 60,
			},
		},
	});
});
