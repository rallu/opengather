import assert from "node:assert/strict";
import test from "node:test";
import { loadAgentMe } from "./api-agents-v1-me.server.ts";

test("loadAgentMe returns machine-readable auth failures", async () => {
	const response = await loadAgentMe({
		request: new Request("http://localhost/api/agents/v1/me", {
			headers: {
				"x-request-id": "req-me-auth-failure",
			},
		}),
		authenticate: async () => ({
			ok: false,
			code: "missing_authorization_header",
			message: "Missing Authorization header.",
		}),
	});

	assert.equal(response.status, 401);
	assert.equal(response.headers.get("x-request-id"), "req-me-auth-failure");
	assert.deepEqual(await response.json(), {
		ok: false,
		meta: {
			requestId: "req-me-auth-failure",
		},
		error: {
			code: "missing_authorization_header",
			message: "Missing Authorization header.",
		},
	});
});

test("loadAgentMe returns agent identity, roles, scopes, and grants", async () => {
	const response = await loadAgentMe({
		request: new Request("http://localhost/api/agents/v1/me", {
			headers: {
				"x-request-id": "req-me-success",
			},
		}),
		authenticate: async () => ({
			ok: true,
			agent: {
				id: "agent-1",
				instanceId: "instance-1",
				createdByUserId: "user-1",
				displayName: "Codex",
				displayLabel: "Codex agent",
				description: "automation",
				role: "assistant",
				isEnabled: true,
				lastUsedAt: new Date("2026-04-06T12:00:00.000Z"),
				deletedAt: null,
				grants: [
					{
						id: "grant-1",
						resourceType: "instance",
						resourceId: "instance-1",
						scope: "instance.feed.read",
					},
				],
			},
			subjectContext: {
				subject: {
					kind: "agent",
					agentId: "agent-1",
				},
				isAuthenticated: true,
				instanceRole: "member",
				groupRoles: new Map([["group-1", "member"]]),
				scopes: new Set(["instance.feed.read"]),
			},
			instanceRole: "member",
			groupRoles: new Map([["group-1", "member"]]),
		}),
	});

	assert.equal(response.status, 200);
	assert.equal(response.headers.get("x-request-id"), "req-me-success");
	assert.deepEqual(await response.json(), {
		ok: true,
		meta: {
			requestId: "req-me-success",
		},
		data: {
			agent: {
				id: "agent-1",
				instanceId: "instance-1",
				createdByUserId: "user-1",
				displayName: "Codex",
				displayLabel: "Codex agent",
				description: "automation",
				role: "assistant",
				isEnabled: true,
				lastUsedAt: "2026-04-06T12:00:00.000Z",
			},
			subject: {
				kind: "agent",
				agentId: "agent-1",
			},
			instanceRole: "member",
			groupRoles: [
				{
					groupId: "group-1",
					role: "member",
				},
			],
			scopes: ["instance.feed.read"],
			grants: [
				{
					id: "grant-1",
					resourceType: "instance",
					resourceId: "instance-1",
					scope: "instance.feed.read",
				},
			],
		},
	});
});

test("loadAgentMe returns 429 when the agent read bucket is exhausted", async () => {
	const response = await loadAgentMe({
		request: new Request("http://localhost/api/agents/v1/me", {
			headers: {
				"x-request-id": "req-me-rate-limit",
			},
		}),
		authenticate: async () => ({
			ok: true,
			agent: {
				id: "agent-1",
				instanceId: "instance-1",
				createdByUserId: "user-1",
				displayName: "Codex",
				displayLabel: "Codex agent",
				description: "automation",
				role: "assistant",
				isEnabled: true,
				lastUsedAt: null,
				deletedAt: null,
				grants: [],
			},
			subjectContext: {
				subject: {
					kind: "agent",
					agentId: "agent-1",
				},
				isAuthenticated: true,
				instanceRole: "member",
				groupRoles: new Map(),
				scopes: new Set(["instance.feed.read"]),
			},
			instanceRole: "member",
			groupRoles: new Map(),
		}),
		rateLimit: () => ({
			allowed: false,
			limit: 2,
			remaining: 0,
			resetAtMs: Date.UTC(2026, 3, 6, 12, 0, 30),
			retryAfterSeconds: 30,
		}),
	});

	assert.equal(response.status, 429);
	assert.equal(response.headers.get("x-request-id"), "req-me-rate-limit");
	assert.equal(response.headers.get("X-RateLimit-Limit"), "2");
	assert.equal(response.headers.get("Retry-After"), "30");
	assert.deepEqual(await response.json(), {
		ok: false,
		meta: {
			requestId: "req-me-rate-limit",
		},
		error: {
			code: "rate_limited",
			message: "Too many agent API requests.",
			details: {
				retryAfterSeconds: 30,
			},
		},
	});
});
