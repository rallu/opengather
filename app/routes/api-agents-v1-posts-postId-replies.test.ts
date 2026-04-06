import assert from "node:assert/strict";
import test from "node:test";
import { createAgentReply } from "./api-agents-v1-posts-postId-replies.ts";

test("createAgentReply validates JSON body", async () => {
	const response = await createAgentReply({
		request: new Request(
			"http://localhost/api/agents/v1/posts/post-1/replies",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-request-id": "req-reply-validation",
				},
				body: JSON.stringify({}),
			},
		),
		postId: "post-1",
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
		resolveParentContext: async () => ({
			ok: true,
			parent: {
				id: "post-1",
				groupId: null,
				rootPostId: "post-1",
			},
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
	assert.deepEqual(await response.json(), {
		ok: false,
		meta: { requestId: "req-reply-validation" },
		error: {
			code: "validation_error",
			message: "bodyText is required.",
		},
	});
});

test("createAgentReply rejects forbidden group replies without group.reply scope", async () => {
	const response = await createAgentReply({
		request: new Request(
			"http://localhost/api/agents/v1/posts/post-1/replies",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-request-id": "req-reply-group-forbidden",
				},
				body: JSON.stringify({ bodyText: "Hello" }),
			},
		),
		postId: "post-1",
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
				groupRoles: new Map([["group-1", "member"]]),
				scopes: new Set(["group.post"]),
			},
			instanceRole: "member",
			groupRoles: new Map([["group-1", "member"]]),
		}),
		resolveParentContext: async () => ({
			ok: true,
			parent: {
				id: "post-1",
				groupId: "group-1",
				rootPostId: "root-1",
			},
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
	assert.deepEqual(await response.json(), {
		ok: false,
		meta: { requestId: "req-reply-group-forbidden" },
		error: {
			code: "forbidden",
			message: "Agent cannot reply in this group.",
			details: {
				reason: "missing_scope",
			},
		},
	});
});

test("createAgentReply creates an auditable instance-feed reply", async () => {
	const created: Array<{ kind: string; data: Record<string, unknown> }> = [];
	const audits: unknown[] = [];
	const ids = ["reply-1", "embedding-1", "moderation-1"];
	const response = await createAgentReply({
		request: new Request(
			"http://localhost/api/agents/v1/posts/post-1/replies",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-request-id": "req-reply-feed-success",
				},
				body: JSON.stringify({ bodyText: "Hello from Codex" }),
			},
		),
		postId: "post-1",
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
						scope: "instance.feed.reply",
					},
				],
			},
			subjectContext: {
				subject: { kind: "agent", agentId: "agent-1" },
				isAuthenticated: true,
				instanceRole: "member",
				groupRoles: new Map(),
				scopes: new Set(["instance.feed.reply"]),
			},
			instanceRole: "member",
			groupRoles: new Map(),
		}),
		resolveParentContext: async () => ({
			ok: true,
			parent: {
				id: "post-1",
				groupId: null,
				rootPostId: "post-1",
			},
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
	assert.deepEqual(await response.json(), {
		ok: true,
		meta: { requestId: "req-reply-feed-success" },
		data: {
			reply: {
				id: "reply-1",
				parentPostId: "post-1",
				rootPostId: "post-1",
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
	assert.equal(created[0]?.data.parentPostId, "post-1");
	assert.equal(created[0]?.data.groupId, null);
	const [audit] = audits as Array<{
		action: string;
		actor: { type: string; id?: string };
		resourceType: string;
		resourceId: string;
		request: Request;
		payload: Record<string, unknown>;
	}>;
	assert.equal(audit.action, "agent.reply.create");
	assert.deepEqual(audit.actor, { type: "agent", id: "agent-1" });
	assert.equal(audit.resourceType, "post");
	assert.equal(audit.resourceId, "reply-1");
	assert.equal(audit.request.method, "POST");
	assert.equal(
		new URL(audit.request.url).pathname,
		"/api/agents/v1/posts/post-1/replies",
	);
	assert.deepEqual(audit.payload, {
		requestId: "req-reply-feed-success",
		parentPostId: "post-1",
		groupId: undefined,
		scope: "instance.feed.reply",
		moderationStatus: "approved",
	});
});

test("createAgentReply creates an auditable group reply", async () => {
	const audits: unknown[] = [];
	const ids = ["reply-2", "embedding-2", "moderation-2"];
	const response = await createAgentReply({
		request: new Request(
			"http://localhost/api/agents/v1/posts/post-2/replies",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-request-id": "req-reply-group-success",
				},
				body: JSON.stringify({ bodyText: "Group reply" }),
			},
		),
		postId: "post-2",
		now: new Date("2026-04-06T12:05:00.000Z"),
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
						scope: "group.reply",
					},
				],
			},
			subjectContext: {
				subject: { kind: "agent", agentId: "agent-1" },
				isAuthenticated: true,
				instanceRole: "member",
				groupRoles: new Map([["group-1", "member"]]),
				scopes: new Set(["group.reply"]),
			},
			instanceRole: "member",
			groupRoles: new Map([["group-1", "member"]]),
		}),
		resolveParentContext: async () => ({
			ok: true,
			parent: {
				id: "post-2",
				groupId: "group-1",
				rootPostId: "root-1",
			},
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

	assert.equal(response.status, 201);
	assert.deepEqual(await response.json(), {
		ok: true,
		meta: { requestId: "req-reply-group-success" },
		data: {
			reply: {
				id: "reply-2",
				parentPostId: "post-2",
				groupId: "group-1",
				rootPostId: "root-1",
				bodyText: "Group reply",
				moderationStatus: "approved",
				createdAt: "2026-04-06T12:05:00.000Z",
				author: {
					type: "agent",
					id: "agent-1",
					displayName: "Codex agent",
				},
			},
		},
	});
	assert.deepEqual(
		(audits[0] as { payload: Record<string, unknown> }).payload,
		{
			requestId: "req-reply-group-success",
			parentPostId: "post-2",
			groupId: "group-1",
			scope: "group.reply",
			moderationStatus: "approved",
		},
	);
});
