import assert from "node:assert/strict";
import test from "node:test";
import { loadAgentGroups } from "./api-agents-v1-groups.server.ts";

test("loadAgentGroups returns machine-readable auth failures", async () => {
	const response = await loadAgentGroups({
		request: new Request("http://localhost/api/agents/v1/groups", {
			headers: {
				"x-request-id": "req-groups-auth-failure",
			},
		}),
		authenticate: async () => ({
			ok: false,
			code: "invalid_token",
			message: "Invalid agent token.",
		}),
	});

	assert.equal(response.status, 401);
	assert.equal(response.headers.get("x-request-id"), "req-groups-auth-failure");
	assert.deepEqual(await response.json(), {
		ok: false,
		meta: {
			requestId: "req-groups-auth-failure",
		},
		error: {
			code: "invalid_token",
			message: "Invalid agent token.",
		},
	});
});

test("loadAgentGroups returns only groups visible to the agent", async () => {
	const response = await loadAgentGroups({
		request: new Request("http://localhost/api/agents/v1/groups", {
			headers: {
				"x-request-id": "req-groups-success",
			},
		}),
		authenticate: async () => ({
			ok: true,
			agent: {
				id: "agent-1",
				instanceId: "instance-1",
				createdByUserId: "user-1",
				displayName: "Codex",
				displayLabel: null,
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
						scope: "group.read",
					},
					{
						id: "grant-2",
						resourceType: "group",
						resourceId: "group-1",
						scope: "group.post",
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
				scopes: new Set(["group.read", "group.post"]),
			},
			instanceRole: "member",
			groupRoles: new Map([["group-1", "member"]]),
		}),
		db: {
			communityGroup: {
				findMany: async () => [
					{
						id: "group-1",
						name: "Visible group",
						description: "allowed",
						visibilityMode: "group_members",
					},
					{
						id: "group-2",
						name: "Hidden group",
						description: "blocked",
						visibilityMode: "private_invite_only",
					},
				],
			},
		},
	});

	assert.equal(response.status, 200);
	assert.equal(response.headers.get("x-request-id"), "req-groups-success");
	assert.deepEqual(await response.json(), {
		ok: true,
		meta: {
			requestId: "req-groups-success",
		},
		data: {
			groups: [
				{
					id: "group-1",
					name: "Visible group",
					description: "allowed",
					visibilityMode: "group_members",
					groupRole: "member",
					canPost: true,
				},
			],
		},
	});
});

test("loadAgentGroups keeps private groups hidden without structural access", async () => {
	const response = await loadAgentGroups({
		request: new Request("http://localhost/api/agents/v1/groups", {
			headers: {
				"x-request-id": "req-groups-private",
			},
		}),
		authenticate: async () => ({
			ok: true,
			agent: {
				id: "agent-2",
				instanceId: "instance-1",
				createdByUserId: "user-1",
				displayName: "Codex",
				displayLabel: null,
				description: null,
				role: "assistant",
				isEnabled: true,
				lastUsedAt: null,
				deletedAt: null,
				grants: [
					{
						id: "grant-1",
						resourceType: "group",
						resourceId: "group-2",
						scope: "group.read",
					},
				],
			},
			subjectContext: {
				subject: {
					kind: "agent",
					agentId: "agent-2",
				},
				isAuthenticated: true,
				instanceRole: "member",
				groupRoles: new Map(),
				scopes: new Set(["group.read"]),
			},
			instanceRole: "member",
			groupRoles: new Map(),
		}),
		db: {
			communityGroup: {
				findMany: async () => [
					{
						id: "group-2",
						name: "Private group",
						description: "should stay hidden",
						visibilityMode: "private_invite_only",
					},
				],
			},
		},
	});

	assert.equal(response.status, 200);
	assert.equal(response.headers.get("x-request-id"), "req-groups-private");
	assert.deepEqual(await response.json(), {
		ok: true,
		meta: {
			requestId: "req-groups-private",
		},
		data: {
			groups: [],
		},
	});
});
