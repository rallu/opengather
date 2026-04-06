import assert from "node:assert/strict";
import test from "node:test";
import { hideAgentPost } from "./api-agents-v1-posts-postId-hide.ts";

test("hideAgentPost rejects non-admin agents", async () => {
	const response = await hideAgentPost({
		request: new Request("http://localhost/api/agents/v1/posts/post-1/hide", {
			method: "POST",
			headers: {
				"x-request-id": "req-hide-forbidden-role",
			},
		}),
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
				scopes: new Set(["moderation.hide_post"]),
			},
			instanceRole: "member",
			groupRoles: new Map(),
		}),
		db: {
			post: { updateMany: async () => ({ count: 1 }) },
			moderationDecision: { create: async () => null },
		},
	});

	assert.equal(response.status, 403);
	assert.deepEqual(await response.json(), {
		ok: false,
		meta: { requestId: "req-hide-forbidden-role" },
		error: {
			code: "forbidden",
			message: "Agent cannot hide posts.",
			details: {
				reason: "admin_required",
			},
		},
	});
});

test("hideAgentPost rejects agents without hide scope", async () => {
	const response = await hideAgentPost({
		request: new Request("http://localhost/api/agents/v1/posts/post-1/hide", {
			method: "POST",
			headers: {
				"x-request-id": "req-hide-forbidden-scope",
			},
		}),
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
				instanceRole: "admin",
				groupRoles: new Map(),
				scopes: new Set(),
			},
			instanceRole: "admin",
			groupRoles: new Map(),
		}),
		db: {
			post: { updateMany: async () => ({ count: 1 }) },
			moderationDecision: { create: async () => null },
		},
	});

	assert.equal(response.status, 403);
	assert.deepEqual(await response.json(), {
		ok: false,
		meta: { requestId: "req-hide-forbidden-scope" },
		error: {
			code: "forbidden",
			message: "Agent cannot hide posts.",
			details: {
				reason: "missing_scope",
			},
		},
	});
});

test("hideAgentPost returns not_found when no post is updated", async () => {
	const response = await hideAgentPost({
		request: new Request("http://localhost/api/agents/v1/posts/post-404/hide", {
			method: "POST",
			headers: {
				"x-request-id": "req-hide-not-found",
			},
		}),
		postId: "post-404",
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
				instanceRole: "admin",
				groupRoles: new Map(),
				scopes: new Set(["moderation.hide_post"]),
			},
			instanceRole: "admin",
			groupRoles: new Map(),
		}),
		db: {
			post: { updateMany: async () => ({ count: 0 }) },
			moderationDecision: { create: async () => null },
		},
	});

	assert.equal(response.status, 404);
	assert.deepEqual(await response.json(), {
		ok: false,
		meta: { requestId: "req-hide-not-found" },
		error: {
			code: "not_found",
			message: "Post not found.",
		},
	});
});

test("hideAgentPost creates agent moderation and audit records", async () => {
	const audits: unknown[] = [];
	const moderationDecisions: unknown[] = [];
	let outboxRuns = 0;
	const response = await hideAgentPost({
		request: new Request("http://localhost/api/agents/v1/posts/post-1/hide", {
			method: "POST",
			headers: {
				"x-request-id": "req-hide-success",
			},
		}),
		postId: "post-1",
		now: new Date("2026-04-06T12:20:00.000Z"),
		generateId: () => "decision-1",
		processNotificationOutboxFn: async () => {
			outboxRuns += 1;
			return 0;
		},
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
				grants: [],
			},
			subjectContext: {
				subject: { kind: "agent", agentId: "agent-1" },
				isAuthenticated: true,
				instanceRole: "admin",
				groupRoles: new Map(),
				scopes: new Set(["moderation.hide_post"]),
			},
			instanceRole: "admin",
			groupRoles: new Map(),
		}),
		db: {
			post: {
				updateMany: async (args) => {
					assert.equal(args.where.id, "post-1");
					assert.equal(args.data.moderationStatus, "rejected");
					return { count: 1 };
				},
			},
			moderationDecision: {
				create: async (args) => {
					moderationDecisions.push(args);
					return args;
				},
			},
		},
	});

	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), {
		ok: true,
		meta: { requestId: "req-hide-success" },
		data: {
			post: {
				id: "post-1",
				moderationStatus: "rejected",
				hiddenAt: "2026-04-06T12:20:00.000Z",
			},
		},
	});
	assert.equal(outboxRuns, 1);
	assert.equal(moderationDecisions.length, 1);
	assert.deepEqual((moderationDecisions[0] as { data: Record<string, unknown> }).data, {
		id: "decision-1",
		postId: "post-1",
		status: "rejected",
		reason: "agent-hide-post",
		actorType: "agent",
		actorId: "agent-1",
		modelName: null,
		createdAt: new Date("2026-04-06T12:20:00.000Z"),
	});
	const [audit] = audits as Array<{
		action: string;
		actor: { type: string; id?: string };
		resourceType: string;
		resourceId: string;
		payload: Record<string, unknown>;
	}>;
	assert.equal(audit.action, "agent.post.hide");
	assert.deepEqual(audit.actor, { type: "agent", id: "agent-1" });
	assert.equal(audit.resourceType, "post");
	assert.equal(audit.resourceId, "post-1");
	assert.deepEqual(audit.payload, {
		requestId: "req-hide-success",
		status: "rejected",
		hide: true,
	});
});
