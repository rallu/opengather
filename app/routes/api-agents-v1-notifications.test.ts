import assert from "node:assert/strict";
import test from "node:test";
import { createAgentNotification } from "./api-agents-v1-notifications.ts";

test("createAgentNotification validates required fields", async () => {
	const response = await createAgentNotification({
		request: new Request("http://localhost/api/agents/v1/notifications", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-request-id": "req-agent-notification-validation",
			},
			body: JSON.stringify({ title: "Hello" }),
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
				scopes: new Set(["instance.notifications.create"]),
			},
			instanceRole: "member",
			groupRoles: new Map(),
		}),
		db: {
			instanceMembership: {
				findFirst: async () => ({ principalId: "user-1" }),
			},
		},
	});

	assert.equal(response.status, 400);
	assert.deepEqual(await response.json(), {
		ok: false,
		meta: {
			requestId: "req-agent-notification-validation",
		},
		error: {
			code: "validation_error",
			message: "userId, title, and body are required.",
		},
	});
});

test("createAgentNotification rejects invalid target URLs", async () => {
	const response = await createAgentNotification({
		request: new Request("http://localhost/api/agents/v1/notifications", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-request-id": "req-agent-notification-url",
			},
			body: JSON.stringify({
				userId: "user-1",
				title: "Hello",
				body: "Message",
				targetUrl: "https://example.com/outside",
			}),
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
				scopes: new Set(["instance.notifications.create"]),
			},
			instanceRole: "member",
			groupRoles: new Map(),
		}),
		db: {
			instanceMembership: {
				findFirst: async () => ({ principalId: "user-1" }),
			},
		},
	});

	assert.equal(response.status, 400);
	assert.deepEqual(await response.json(), {
		ok: false,
		meta: {
			requestId: "req-agent-notification-url",
		},
		error: {
			code: "validation_error",
			message: "targetUrl must be an app-relative path.",
		},
	});
});

test("createAgentNotification rejects agents without notification scope", async () => {
	const response = await createAgentNotification({
		request: new Request("http://localhost/api/agents/v1/notifications", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-request-id": "req-agent-notification-forbidden",
			},
			body: JSON.stringify({
				userId: "user-1",
				title: "Hello",
				body: "Message",
			}),
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
			instanceMembership: {
				findFirst: async () => ({ principalId: "user-1" }),
			},
		},
	});

	assert.equal(response.status, 403);
	assert.deepEqual(await response.json(), {
		ok: false,
		meta: {
			requestId: "req-agent-notification-forbidden",
		},
		error: {
			code: "forbidden",
			message: "Agent cannot create notifications.",
			details: {
				reason: "missing_scope",
			},
		},
	});
});

test("createAgentNotification creates an auditable agent message notification", async () => {
	const audits: unknown[] = [];
	const response = await createAgentNotification({
		request: new Request("http://localhost/api/agents/v1/notifications", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-request-id": "req-agent-notification-success",
			},
			body: JSON.stringify({
				userId: "user-1",
				title: "Reminder",
				body: "Please review the agenda.",
				targetUrl: "/groups/group-1",
			}),
		}),
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
				instanceRole: "member",
				groupRoles: new Map(),
				scopes: new Set(["instance.notifications.create"]),
			},
			instanceRole: "member",
			groupRoles: new Map(),
		}),
		db: {
			instanceMembership: {
				findFirst: async () => ({ principalId: "user-1" }),
			},
		},
		createNotificationFn: async () => ({
			id: "notification-1",
			userId: "user-1",
			kind: "agent_message",
			title: "Reminder",
			body: "Please review the agenda.",
			targetUrl: "/groups/group-1",
			createdAt: "2026-04-06T12:10:00.000Z",
		}),
		writeAuditLog: async (params) => {
			audits.push(params);
		},
	});

	assert.equal(response.status, 201);
	assert.deepEqual(await response.json(), {
		ok: true,
		meta: {
			requestId: "req-agent-notification-success",
		},
		data: {
			notification: {
				id: "notification-1",
				userId: "user-1",
				kind: "agent_message",
				title: "Reminder",
				body: "Please review the agenda.",
				targetUrl: "/groups/group-1",
				createdAt: "2026-04-06T12:10:00.000Z",
			},
		},
	});
	const [audit] = audits as Array<{
		action: string;
		actor: { type: string; id?: string };
		resourceType: string;
		resourceId: string;
		payload: Record<string, unknown>;
	}>;
	assert.equal(audit.action, "agent.notification.create");
	assert.deepEqual(audit.actor, { type: "agent", id: "agent-1" });
	assert.equal(audit.resourceType, "notification");
	assert.equal(audit.resourceId, "notification-1");
	assert.deepEqual(audit.payload, {
		requestId: "req-agent-notification-success",
		userId: "user-1",
		kind: "agent_message",
	});
});
