import assert from "node:assert/strict";
import test from "node:test";
import {
	authenticateAgentRequest,
	hashAgentToken,
	parseAgentBearerToken,
} from "./agent-auth.server.ts";

test("parseAgentBearerToken requires Bearer authorization", () => {
	const missing = parseAgentBearerToken({
		request: new Request("http://localhost/api/agents/v1/me"),
	});
	assert.deepEqual(missing, {
		ok: false,
		code: "missing_authorization_header",
		message: "Missing Authorization header.",
	});

	const invalid = parseAgentBearerToken({
		request: new Request("http://localhost/api/agents/v1/me", {
			headers: {
				authorization: "Basic abc123",
			},
		}),
	});
	assert.deepEqual(invalid, {
		ok: false,
		code: "invalid_authorization_header",
		message: "Authorization header must use Bearer token format.",
	});
});

test("authenticateAgentRequest resolves agent subject context and updates lastUsedAt", async () => {
	const updates: unknown[] = [];
	const token = "oga_test_token";
	const now = new Date("2026-04-06T12:00:00.000Z");
	const db = {
		agent: {
			findUnique: async () => ({
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
				grants: [
					{
						id: "grant-1",
						resourceType: "instance",
						resourceId: "instance-1",
						scope: "instance.feed.read",
					},
					{
						id: "grant-2",
						resourceType: "group",
						resourceId: "group-1",
						scope: "group.post",
					},
				],
			}),
			update: async (args: unknown) => {
				updates.push(args);
				return args;
			},
		},
		instanceMembership: {
			findFirst: async () => ({
				role: "member",
				approvalStatus: "approved",
			}),
		},
		groupMembership: {
			findMany: async () => [
				{
					groupId: "group-1",
					role: "member",
					approvalStatus: "approved",
				},
			],
		},
	};

	const result = await authenticateAgentRequest({
		request: new Request("http://localhost/api/agents/v1/me", {
			headers: {
				authorization: `Bearer ${token}`,
			},
		}),
		db,
		now,
	});

	assert.equal(result.ok, true);
	if (!result.ok) {
		return;
	}

	assert.equal(result.agent.id, "agent-1");
	assert.equal(result.instanceRole, "member");
	assert.equal(result.groupRoles.get("group-1"), "member");
	assert.equal(result.subjectContext.subject.kind, "agent");
	assert.equal(result.subjectContext.subject.agentId, "agent-1");
	assert.equal(result.subjectContext.scopes.has("instance.feed.read"), true);
	assert.equal(result.subjectContext.scopes.has("group.post"), true);
	assert.equal(
		result.subjectContext.resourceScopes?.get("group")?.get("group-1")?.has("group.post"),
		true,
	);
	assert.equal(
		result.subjectContext.resourceScopes?.get("group")?.get("group-2")?.has("group.post") ??
			false,
		false,
	);
	assert.deepEqual(updates, [
		{
			where: { id: "agent-1" },
			data: { lastUsedAt: now },
		},
	]);
	assert.equal(hashAgentToken(token).length, 64);
});

test("authenticateAgentRequest rejects invalid and disabled agents", async () => {
	const baseRequest = new Request("http://localhost/api/agents/v1/me", {
		headers: {
			authorization: "Bearer oga_invalid",
		},
	});

	const missingResult = await authenticateAgentRequest({
		request: baseRequest,
		db: {
			agent: {
				findUnique: async () => null,
				update: async () => null,
			},
			instanceMembership: {
				findFirst: async () => null,
			},
			groupMembership: {
				findMany: async () => [],
			},
		},
	});
	assert.deepEqual(missingResult, {
		ok: false,
		code: "invalid_token",
		message: "Invalid agent token.",
	});

	const disabledResult = await authenticateAgentRequest({
		request: baseRequest,
		db: {
			agent: {
				findUnique: async () => ({
					id: "agent-2",
					instanceId: "instance-1",
					createdByUserId: null,
					displayName: "Disabled agent",
					displayLabel: null,
					description: null,
					role: "assistant",
					isEnabled: false,
					lastUsedAt: null,
					deletedAt: null,
					grants: [],
				}),
				update: async () => null,
			},
			instanceMembership: {
				findFirst: async () => null,
			},
			groupMembership: {
				findMany: async () => [],
			},
		},
	});
	assert.deepEqual(disabledResult, {
		ok: false,
		code: "disabled_agent",
		message: "Agent is disabled.",
	});
});
