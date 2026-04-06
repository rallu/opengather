import assert from "node:assert/strict";
import test from "node:test";
import {
	createAgent,
	disableAgent,
	generateAgentToken,
	listAgentMcpSessions,
	listAgents,
	revokeAgentMcpSession,
	rotateAgentToken,
	setAgentGrants,
} from "./agent.service.server.ts";

test("generateAgentToken uses the oga_ prefix", () => {
	const token = generateAgentToken({
		randomBytesFn: () => Buffer.from("a".repeat(24)),
	});
	assert.equal(token.startsWith("oga_"), true);
});

test("createAgent stores hashed token, memberships, and grants", async () => {
	const writes: Array<{ table: string; data: Record<string, unknown> }> = [];
	const ids = [
		"agent-1",
		"instance-membership-1",
		"group-membership-1",
		"grant-1",
	];
	const result = await createAgent({
		instanceId: "instance-1",
		createdByUserId: "user-1",
		displayName: "Codex",
		displayLabel: "Codex agent",
		description: "automation",
		instanceRole: "member",
		groupMemberships: [{ groupId: "group-1", role: "member" }],
		grants: [
			{
				resourceType: "group",
				resourceId: "group-1",
				scope: "group.post",
			},
		],
		now: new Date("2026-04-06T12:00:00.000Z"),
		generateId: () => ids.shift() ?? "extra-id",
		generateToken: () => "oga_test_token",
		db: {
			$transaction: async (callback) =>
				callback({
					agent: {
						create: async (args) => {
							writes.push({ table: "agent", data: args.data });
							return args;
						},
						update: async () => null,
					},
					agentGrant: {
						create: async (args) => {
							writes.push({ table: "agentGrant", data: args.data });
							return args;
						},
						deleteMany: async () => null,
					},
					instanceMembership: {
						create: async (args) => {
							writes.push({
								table: "instanceMembership",
								data: args.data,
							});
							return args;
						},
					},
					groupMembership: {
						create: async (args) => {
							writes.push({ table: "groupMembership", data: args.data });
							return args;
						},
					},
					agentMcpSession: {
						update: async () => null,
					},
					agentMcpAccessToken: {
						updateMany: async () => null,
					},
					agentMcpRefreshToken: {
						updateMany: async () => null,
					},
				}),
			agent: {
				findMany: async () => [],
				update: async () => null,
			},
			agentMcpSession: {
				findMany: async () => [],
			},
		},
	});

	assert.deepEqual(result, {
		agentId: "agent-1",
		token: "oga_test_token",
	});
	assert.equal(writes[0]?.table, "agent");
	assert.equal(writes[0]?.data.id, "agent-1");
	assert.equal(
		writes[0]?.data.apiKeyHash,
		result.token ? writes[0]?.data.apiKeyHash : "",
	);
	assert.notEqual(writes[0]?.data.apiKeyHash, "oga_test_token");
	assert.equal(writes[1]?.table, "instanceMembership");
	assert.equal(writes[2]?.table, "groupMembership");
	assert.equal(writes[3]?.table, "agentGrant");
});

test("rotateAgentToken replaces the stored token hash", async () => {
	const updates: unknown[] = [];
	const result = await rotateAgentToken({
		agentId: "agent-1",
		now: new Date("2026-04-06T12:00:00.000Z"),
		generateToken: () => "oga_rotated",
		db: {
			$transaction: async (callback) =>
				callback({
					agent: {
						create: async () => null,
						update: async () => null,
					},
					agentGrant: {
						create: async () => null,
						deleteMany: async () => null,
					},
					instanceMembership: {
						create: async () => null,
					},
					groupMembership: {
						create: async () => null,
					},
					agentMcpSession: {
						update: async () => null,
					},
					agentMcpAccessToken: {
						updateMany: async () => null,
					},
					agentMcpRefreshToken: {
						updateMany: async () => null,
					},
				}),
			agent: {
				findMany: async () => [],
				update: async (args) => {
					updates.push(args);
					return args;
				},
			},
			agentMcpSession: {
				findMany: async () => [],
			},
		},
	});

	assert.deepEqual(result, {
		agentId: "agent-1",
		token: "oga_rotated",
	});
	assert.equal(updates.length, 1);
});

test("disableAgent marks the agent disabled", async () => {
	const updates: unknown[] = [];
	const result = await disableAgent({
		agentId: "agent-1",
		now: new Date("2026-04-06T12:00:00.000Z"),
		db: {
			$transaction: async (callback) =>
				callback({
					agent: {
						create: async () => null,
						update: async () => null,
					},
					agentGrant: {
						create: async () => null,
						deleteMany: async () => null,
					},
					instanceMembership: {
						create: async () => null,
					},
					groupMembership: {
						create: async () => null,
					},
					agentMcpSession: {
						update: async () => null,
					},
					agentMcpAccessToken: {
						updateMany: async () => null,
					},
					agentMcpRefreshToken: {
						updateMany: async () => null,
					},
				}),
			agent: {
				findMany: async () => [],
				update: async (args) => {
					updates.push(args);
					return args;
				},
			},
			agentMcpSession: {
				findMany: async () => [],
			},
		},
	});

	assert.deepEqual(result, {
		agentId: "agent-1",
		disabled: true,
	});
	assert.equal(updates.length, 1);
});

test("disableAgent revokes active MCP sessions for the agent", async () => {
	const writes: Array<{ table: string; value: unknown }> = [];
	const now = new Date("2026-04-06T12:00:00.000Z");

	await disableAgent({
		agentId: "agent-1",
		now,
		db: {
			$transaction: async (callback) =>
				callback({
					agent: {
						create: async () => null,
						update: async () => null,
					},
					agentGrant: {
						create: async () => null,
						deleteMany: async () => null,
					},
					instanceMembership: {
						create: async () => null,
					},
					groupMembership: {
						create: async () => null,
					},
					agentMcpSession: {
						update: async (args) => {
							writes.push({ table: "agentMcpSession.update", value: args });
							return args;
						},
					},
					agentMcpAccessToken: {
						updateMany: async (args) => {
							writes.push({
								table: "agentMcpAccessToken.updateMany",
								value: args,
							});
							return args;
						},
					},
					agentMcpRefreshToken: {
						updateMany: async (args) => {
							writes.push({
								table: "agentMcpRefreshToken.updateMany",
								value: args,
							});
							return args;
						},
					},
				}),
			agent: {
				findMany: async () => [],
				update: async () => null,
			},
			agentMcpSession: {
				findMany: async () => [
					{
						id: "session-1",
						agentId: "agent-1",
						userId: "user-1",
						clientId: "codex",
						expiresAt: new Date("2026-05-06T12:00:00.000Z"),
						revokedAt: null,
						lastUsedAt: null,
						createdAt: new Date("2026-04-06T11:00:00.000Z"),
						updatedAt: new Date("2026-04-06T11:00:00.000Z"),
						agent: {
							displayName: "Codex",
							displayLabel: "Codex agent",
						},
					},
				],
			},
		},
	});

	assert.deepEqual(writes, [
		{
			table: "agentMcpSession.update",
			value: {
				where: { id: "session-1" },
				data: {
					revokedAt: now,
					updatedAt: now,
				},
			},
		},
		{
			table: "agentMcpAccessToken.updateMany",
			value: {
				where: { sessionId: "session-1", revokedAt: null },
				data: {
					revokedAt: now,
				},
			},
		},
		{
			table: "agentMcpRefreshToken.updateMany",
			value: {
				where: { sessionId: "session-1", revokedAt: null },
				data: {
					revokedAt: now,
				},
			},
		},
	]);
});

test("disableAgent tolerates missing MCP session tables", async () => {
	const updates: unknown[] = [];
	const result = await disableAgent({
		agentId: "agent-1",
		now: new Date("2026-04-06T12:00:00.000Z"),
		db: {
			$transaction: async (callback) =>
				callback({
					agent: {
						create: async () => null,
						update: async () => null,
					},
					agentGrant: {
						create: async () => null,
						deleteMany: async () => null,
					},
					instanceMembership: {
						create: async () => null,
					},
					groupMembership: {
						create: async () => null,
					},
					agentMcpSession: {
						update: async () => null,
					},
					agentMcpAccessToken: {
						updateMany: async () => null,
					},
					agentMcpRefreshToken: {
						updateMany: async () => null,
					},
				}),
			agent: {
				findMany: async () => [],
				update: async (args) => {
					updates.push(args);
					return args;
				},
			},
			agentMcpSession: {
				findMany: async () => {
					const error = new Error(
						'relation "agent_mcp_session" does not exist',
					);
					(error as Error & { code?: string }).code = "P2021";
					throw error;
				},
			},
		},
	});

	assert.deepEqual(result, {
		agentId: "agent-1",
		disabled: true,
	});
	assert.equal(updates.length, 1);
});

test("listAgents returns non-deleted agents with sorted grants", async () => {
	const findManyCalls: unknown[] = [];
	const result = await listAgents({
		instanceId: "instance-1",
		db: {
			$transaction: async (callback) =>
				callback({
					agent: {
						create: async () => null,
						update: async () => null,
					},
					agentGrant: {
						create: async () => null,
						deleteMany: async () => null,
					},
					instanceMembership: {
						create: async () => null,
					},
					groupMembership: {
						create: async () => null,
					},
					agentMcpSession: {
						update: async () => null,
					},
					agentMcpAccessToken: {
						updateMany: async () => null,
					},
					agentMcpRefreshToken: {
						updateMany: async () => null,
					},
				}),
			agent: {
				findMany: async (args) => {
					findManyCalls.push(args);
					return [
						{
							id: "agent-2",
							instanceId: "instance-1",
							createdByUserId: "user-1",
							displayName: "Codex",
							displayLabel: "Codex agent",
							description: "automation",
							role: "assistant",
							isEnabled: true,
							lastUsedAt: new Date("2026-04-06T12:05:00.000Z"),
							deletedAt: null,
							createdAt: new Date("2026-04-06T12:00:00.000Z"),
							updatedAt: new Date("2026-04-06T12:06:00.000Z"),
							grants: [
								{
									id: "grant-1",
									resourceType: "group",
									resourceId: "group-1",
									scope: "group.post",
									createdAt: new Date("2026-04-06T12:00:00.000Z"),
									updatedAt: new Date("2026-04-06T12:00:00.000Z"),
								},
							],
						},
					];
				},
				update: async () => null,
			},
			agentMcpSession: {
				findMany: async () => [],
			},
		},
	});

	assert.equal(findManyCalls.length, 1);
	assert.deepEqual(findManyCalls[0], {
		where: {
			instanceId: "instance-1",
			deletedAt: null,
		},
		orderBy: [{ createdAt: "desc" }, { id: "asc" }],
		include: {
			grants: {
				orderBy: [
					{ resourceType: "asc" },
					{ resourceId: "asc" },
					{ scope: "asc" },
					{ id: "asc" },
				],
			},
		},
	});
	assert.equal(result.length, 1);
	assert.equal(result[0]?.id, "agent-2");
	assert.equal(result[0]?.grants[0]?.scope, "group.post");
});

test("setAgentGrants replaces existing grants with a normalized set", async () => {
	const writes: Array<{ table: string; value: unknown }> = [];
	const ids = ["grant-1", "grant-2"];
	const now = new Date("2026-04-06T12:00:00.000Z");

	const result = await setAgentGrants({
		agentId: "agent-1",
		now,
		generateId: () => ids.shift() ?? "extra-id",
		grants: [
			{
				resourceType: " group ",
				resourceId: " group-2 ",
				scope: " group.reply ",
			},
			{
				resourceType: "group",
				resourceId: "group-1",
				scope: "group.post",
			},
			{
				resourceType: "group",
				resourceId: "group-1",
				scope: "group.post",
			},
		],
		db: {
			$transaction: async (callback) =>
				callback({
					agent: {
						create: async () => null,
						update: async (args) => {
							writes.push({ table: "agent.update", value: args });
							return args;
						},
					},
					agentGrant: {
						create: async (args) => {
							writes.push({ table: "agentGrant.create", value: args });
							return args;
						},
						deleteMany: async (args) => {
							writes.push({ table: "agentGrant.deleteMany", value: args });
							return args;
						},
					},
					instanceMembership: {
						create: async () => null,
					},
					groupMembership: {
						create: async () => null,
					},
					agentMcpSession: {
						update: async () => null,
					},
					agentMcpAccessToken: {
						updateMany: async () => null,
					},
					agentMcpRefreshToken: {
						updateMany: async () => null,
					},
				}),
			agent: {
				findMany: async () => [],
				update: async () => null,
			},
			agentMcpSession: {
				findMany: async () => [],
			},
		},
	});

	assert.deepEqual(writes, [
		{
			table: "agentGrant.deleteMany",
			value: { where: { agentId: "agent-1" } },
		},
		{
			table: "agentGrant.create",
			value: {
				data: {
					id: "grant-1",
					agentId: "agent-1",
					resourceType: "group",
					resourceId: "group-1",
					scope: "group.post",
					createdAt: now,
					updatedAt: now,
				},
			},
		},
		{
			table: "agentGrant.create",
			value: {
				data: {
					id: "grant-2",
					agentId: "agent-1",
					resourceType: "group",
					resourceId: "group-2",
					scope: "group.reply",
					createdAt: now,
					updatedAt: now,
				},
			},
		},
		{
			table: "agent.update",
			value: {
				where: { id: "agent-1" },
				data: { updatedAt: now },
			},
		},
	]);
	assert.deepEqual(result, {
		agentId: "agent-1",
		grants: [
			{
				id: "grant-1",
				resourceType: "group",
				resourceId: "group-1",
				scope: "group.post",
				createdAt: now,
				updatedAt: now,
			},
			{
				id: "grant-2",
				resourceType: "group",
				resourceId: "group-2",
				scope: "group.reply",
				createdAt: now,
				updatedAt: now,
			},
		],
	});
});

test("setAgentGrants revokes active MCP sessions after a scope change", async () => {
	const writes: Array<{ table: string; value: unknown }> = [];
	const now = new Date("2026-04-06T12:00:00.000Z");

	await setAgentGrants({
		agentId: "agent-1",
		now,
		generateId: () => "grant-1",
		grants: [
			{
				resourceType: "instance",
				resourceId: "instance-1",
				scope: "instance.feed.read",
			},
		],
		db: {
			$transaction: async (callback) =>
				callback({
					agent: {
						create: async () => null,
						update: async (args) => {
							writes.push({ table: "agent.update", value: args });
							return args;
						},
					},
					agentGrant: {
						create: async (args) => {
							writes.push({ table: "agentGrant.create", value: args });
							return args;
						},
						deleteMany: async (args) => {
							writes.push({ table: "agentGrant.deleteMany", value: args });
							return args;
						},
					},
					instanceMembership: {
						create: async () => null,
					},
					groupMembership: {
						create: async () => null,
					},
					agentMcpSession: {
						update: async (args) => {
							writes.push({ table: "agentMcpSession.update", value: args });
							return args;
						},
					},
					agentMcpAccessToken: {
						updateMany: async (args) => {
							writes.push({
								table: "agentMcpAccessToken.updateMany",
								value: args,
							});
							return args;
						},
					},
					agentMcpRefreshToken: {
						updateMany: async (args) => {
							writes.push({
								table: "agentMcpRefreshToken.updateMany",
								value: args,
							});
							return args;
						},
					},
				}),
			agent: {
				findMany: async () => [],
				update: async () => null,
			},
			agentMcpSession: {
				findMany: async () => [
					{
						id: "session-1",
						agentId: "agent-1",
						userId: "user-1",
						clientId: "codex",
						expiresAt: new Date("2026-05-06T12:00:00.000Z"),
						revokedAt: null,
						lastUsedAt: null,
						createdAt: new Date("2026-04-06T11:00:00.000Z"),
						updatedAt: new Date("2026-04-06T11:00:00.000Z"),
						agent: {
							displayName: "Codex",
							displayLabel: "Codex agent",
						},
					},
				],
			},
		},
	});

	assert.deepEqual(writes.slice(-3), [
		{
			table: "agentMcpSession.update",
			value: {
				where: { id: "session-1" },
				data: {
					revokedAt: now,
					updatedAt: now,
				},
			},
		},
		{
			table: "agentMcpAccessToken.updateMany",
			value: {
				where: { sessionId: "session-1", revokedAt: null },
				data: {
					revokedAt: now,
				},
			},
		},
		{
			table: "agentMcpRefreshToken.updateMany",
			value: {
				where: { sessionId: "session-1", revokedAt: null },
				data: {
					revokedAt: now,
				},
			},
		},
	]);
});

test("setAgentGrants tolerates missing MCP session tables", async () => {
	const writes: Array<{ table: string; value: unknown }> = [];
	const now = new Date("2026-04-06T12:00:00.000Z");

	const result = await setAgentGrants({
		agentId: "agent-1",
		now,
		generateId: () => "grant-1",
		grants: [
			{
				resourceType: "instance",
				resourceId: "instance-1",
				scope: "instance.feed.read",
			},
		],
		db: {
			$transaction: async (callback) =>
				callback({
					agent: {
						create: async () => null,
						update: async (args) => {
							writes.push({ table: "agent.update", value: args });
							return args;
						},
					},
					agentGrant: {
						create: async (args) => {
							writes.push({ table: "agentGrant.create", value: args });
							return args;
						},
						deleteMany: async (args) => {
							writes.push({ table: "agentGrant.deleteMany", value: args });
							return args;
						},
					},
					instanceMembership: {
						create: async () => null,
					},
					groupMembership: {
						create: async () => null,
					},
					agentMcpSession: {
						update: async () => null,
					},
					agentMcpAccessToken: {
						updateMany: async () => null,
					},
					agentMcpRefreshToken: {
						updateMany: async () => null,
					},
				}),
			agent: {
				findMany: async () => [],
				update: async () => null,
			},
			agentMcpSession: {
				findMany: async () => {
					const error = new Error(
						'relation "agent_mcp_session" does not exist',
					);
					(error as Error & { code?: string }).code = "P2021";
					throw error;
				},
			},
		},
	});

	assert.deepEqual(result, {
		agentId: "agent-1",
		grants: [
			{
				id: "grant-1",
				resourceType: "instance",
				resourceId: "instance-1",
				scope: "instance.feed.read",
				createdAt: now,
				updatedAt: now,
			},
		],
	});
});

test("listAgentMcpSessions returns sessions scoped to the current instance", async () => {
	const findManyCalls: unknown[] = [];
	const result = await listAgentMcpSessions({
		instanceId: "instance-1",
		db: {
			$transaction: async (callback) =>
				callback({
					agent: {
						create: async () => null,
						update: async () => null,
					},
					agentGrant: {
						create: async () => null,
						deleteMany: async () => null,
					},
					instanceMembership: {
						create: async () => null,
					},
					groupMembership: {
						create: async () => null,
					},
					agentMcpSession: {
						update: async () => null,
					},
					agentMcpAccessToken: {
						updateMany: async () => null,
					},
					agentMcpRefreshToken: {
						updateMany: async () => null,
					},
				}),
			agent: {
				findMany: async () => [],
				update: async () => null,
			},
			agentMcpSession: {
				findMany: async (args) => {
					findManyCalls.push(args);
					return [
						{
							id: "session-1",
							agentId: "agent-1",
							userId: "user-1",
							clientId: "codex",
							expiresAt: new Date("2026-05-06T12:00:00.000Z"),
							revokedAt: null,
							lastUsedAt: new Date("2026-04-06T12:30:00.000Z"),
							createdAt: new Date("2026-04-06T12:00:00.000Z"),
							updatedAt: new Date("2026-04-06T12:30:00.000Z"),
							agent: {
								displayName: "Codex",
								displayLabel: "Codex agent",
							},
						},
					];
				},
			},
		},
	});

	assert.deepEqual(findManyCalls[0], {
		where: {
			agent: {
				instanceId: "instance-1",
				deletedAt: null,
			},
		},
		orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }, { id: "asc" }],
		select: {
			id: true,
			agentId: true,
			userId: true,
			clientId: true,
			expiresAt: true,
			revokedAt: true,
			lastUsedAt: true,
			createdAt: true,
			updatedAt: true,
			agent: {
				select: {
					displayName: true,
					displayLabel: true,
				},
			},
		},
	});
	assert.equal(result.length, 1);
	assert.equal(result[0]?.id, "session-1");
});

test("revokeAgentMcpSession revokes the session and both token families", async () => {
	const writes: Array<{ table: string; value: unknown }> = [];
	const now = new Date("2026-04-06T12:00:00.000Z");

	const result = await revokeAgentMcpSession({
		sessionId: "session-1",
		now,
		db: {
			$transaction: async (callback) =>
				callback({
					agent: {
						create: async () => null,
						update: async () => null,
					},
					agentGrant: {
						create: async () => null,
						deleteMany: async () => null,
					},
					instanceMembership: {
						create: async () => null,
					},
					groupMembership: {
						create: async () => null,
					},
					agentMcpSession: {
						update: async (args) => {
							writes.push({ table: "agentMcpSession.update", value: args });
							return args;
						},
					},
					agentMcpAccessToken: {
						updateMany: async (args) => {
							writes.push({
								table: "agentMcpAccessToken.updateMany",
								value: args,
							});
							return args;
						},
					},
					agentMcpRefreshToken: {
						updateMany: async (args) => {
							writes.push({
								table: "agentMcpRefreshToken.updateMany",
								value: args,
							});
							return args;
						},
					},
				}),
			agent: {
				findMany: async () => [],
				update: async () => null,
			},
			agentMcpSession: {
				findMany: async () => [],
			},
		},
	});

	assert.deepEqual(result, {
		sessionId: "session-1",
		revoked: true,
	});
	assert.deepEqual(writes, [
		{
			table: "agentMcpSession.update",
			value: {
				where: { id: "session-1" },
				data: {
					revokedAt: now,
					updatedAt: now,
				},
			},
		},
		{
			table: "agentMcpAccessToken.updateMany",
			value: {
				where: { sessionId: "session-1", revokedAt: null },
				data: {
					revokedAt: now,
				},
			},
		},
		{
			table: "agentMcpRefreshToken.updateMany",
			value: {
				where: { sessionId: "session-1", revokedAt: null },
				data: {
					revokedAt: now,
				},
			},
		},
	]);
});
