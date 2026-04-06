import assert from "node:assert/strict";
import test from "node:test";
import { loadAgentGroups } from "../routes/api-agents-v1-groups.ts";
import { createAgentGroupPost } from "../routes/api-agents-v1-groups-group-posts.ts";
import { loadAgentMe } from "../routes/api-agents-v1-me.ts";
import { createAgent, rotateAgentToken } from "./agent.service.server.ts";
import { authenticateAgentRequest } from "./agent-auth.server.ts";
import { loadPostAuthorSummaryMap } from "./post-author.service.server.ts";

type StoredAgent = {
	id: string;
	instanceId: string;
	createdByUserId: string | null;
	displayName: string;
	displayLabel: string | null;
	description: string | null;
	role: string;
	apiKeyHash: string;
	isEnabled: boolean;
	lastUsedAt: Date | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

type StoredAgentGrant = {
	id: string;
	agentId: string;
	resourceType: string;
	resourceId: string;
	scope: string;
	createdAt: Date;
	updatedAt: Date;
};

type StoredInstanceMembership = {
	id: string;
	instanceId: string;
	principalId: string;
	principalType: "agent";
	role: string;
	approvalStatus: string;
	createdAt: Date;
	updatedAt: Date;
};

type StoredGroupMembership = {
	id: string;
	groupId: string;
	principalId: string;
	principalType: "agent";
	role: string;
	approvalStatus: string;
	createdAt: Date;
	updatedAt: Date;
};

type StoredGroup = {
	id: string;
	instanceId: string;
	name: string;
	description: string | null;
	visibilityMode: string;
	createdAt: Date;
	updatedAt: Date;
};

type StoredPost = {
	id: string;
	instanceId: string;
	authorId: string;
	authorType: "agent";
	groupId: string | null;
	rootPostId: string;
	parentPostId: string | null;
	contentType: "text";
	bodyText: string;
	moderationStatus: string;
	hiddenAt: Date | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

type IntegrationHarness = ReturnType<typeof createIntegrationHarness>;

function createIntegrationHarness() {
	let sequence = 0;
	const state = {
		agents: [] as StoredAgent[],
		agentGrants: [] as StoredAgentGrant[],
		instanceMemberships: [] as StoredInstanceMembership[],
		groupMemberships: [] as StoredGroupMembership[],
		groups: [] as StoredGroup[],
		posts: [] as StoredPost[],
		postEmbeddings: [] as Array<Record<string, unknown>>,
		moderationDecisions: [] as Array<Record<string, unknown>>,
		auditLogs: [] as Array<Record<string, unknown>>,
	};

	const nextId = (prefix: string) => `${prefix}-${++sequence}`;

	const db = {
		$transaction: async <T>(
			callback: (trx: {
				agent: {
					create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
					update: (args: {
						where: { id: string };
						data: Record<string, unknown>;
					}) => Promise<unknown>;
				};
				agentGrant: {
					create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
					deleteMany: (args: {
						where: { agentId: string };
					}) => Promise<unknown>;
				};
				instanceMembership: {
					create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
				};
				groupMembership: {
					create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
				};
				post: {
					create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
				};
				postEmbedding: {
					create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
				};
				moderationDecision: {
					create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
				};
			}) => Promise<T>,
		): Promise<T> =>
			callback({
				agent: {
					create: async (args) => {
						state.agents.push(args.data as unknown as StoredAgent);
						return args.data;
					},
					update: async (args) => {
						const agent = state.agents.find(
							(candidate) => candidate.id === args.where.id,
						);
						if (!agent) {
							throw new Error(`Unknown agent ${args.where.id}`);
						}
						Object.assign(agent, args.data);
						return agent;
					},
				},
				agentGrant: {
					create: async (args) => {
						state.agentGrants.push(args.data as unknown as StoredAgentGrant);
						return args.data;
					},
					deleteMany: async (args) => {
						state.agentGrants = state.agentGrants.filter(
							(grant) => grant.agentId !== args.where.agentId,
						);
						return { count: 1 };
					},
				},
				instanceMembership: {
					create: async (args) => {
						state.instanceMemberships.push(
							args.data as unknown as StoredInstanceMembership,
						);
						return args.data;
					},
				},
				groupMembership: {
					create: async (args) => {
						state.groupMemberships.push(
							args.data as unknown as StoredGroupMembership,
						);
						return args.data;
					},
				},
				post: {
					create: async (args) => {
						state.posts.push(args.data as unknown as StoredPost);
						return args.data;
					},
				},
				postEmbedding: {
					create: async (args) => {
						state.postEmbeddings.push(args.data);
						return args.data;
					},
				},
				moderationDecision: {
					create: async (args) => {
						state.moderationDecisions.push(args.data);
						return args.data;
					},
				},
			}),
		agent: {
			findUnique: async (args: {
				where: { apiKeyHash: string };
				select: Record<string, unknown>;
			}) => {
				const agent = state.agents.find(
					(candidate) => candidate.apiKeyHash === args.where.apiKeyHash,
				);
				if (!agent) {
					return null;
				}
				return {
					id: agent.id,
					instanceId: agent.instanceId,
					createdByUserId: agent.createdByUserId,
					displayName: agent.displayName,
					displayLabel: agent.displayLabel,
					description: agent.description,
					role: agent.role,
					isEnabled: agent.isEnabled,
					lastUsedAt: agent.lastUsedAt,
					deletedAt: agent.deletedAt,
					grants: state.agentGrants
						.filter((grant) => grant.agentId === agent.id)
						.map((grant) => ({
							id: grant.id,
							resourceType: grant.resourceType,
							resourceId: grant.resourceId,
							scope: grant.scope,
						})),
				};
			},
			findMany: async (args: {
				where: Record<string, unknown>;
				select?: Record<string, unknown>;
				orderBy?: Array<Record<string, unknown>>;
				include?: { grants: { orderBy: Array<Record<string, unknown>> } };
			}) => {
				const idFilter = (args.where.id as { in?: string[] } | undefined)?.in;
				if (idFilter) {
					return state.agents
						.filter((agent) => idFilter.includes(agent.id))
						.map((agent) => ({
							id: agent.id,
							displayName: agent.displayName,
							displayLabel: agent.displayLabel,
						}));
				}

				const instanceId = args.where.instanceId as string | undefined;
				return state.agents
					.filter((agent) =>
						instanceId ? agent.instanceId === instanceId : true,
					)
					.filter((agent) =>
						args.where.deletedAt === null ? agent.deletedAt === null : true,
					)
					.map((agent) => ({
						...agent,
						grants: state.agentGrants
							.filter((grant) => grant.agentId === agent.id)
							.map((grant) => ({ ...grant })),
					}));
			},
			update: async (args: {
				where: { id: string };
				data: Record<string, unknown>;
			}) => {
				const agent = state.agents.find(
					(candidate) => candidate.id === args.where.id,
				);
				if (!agent) {
					throw new Error(`Unknown agent ${args.where.id}`);
				}
				Object.assign(agent, args.data);
				return agent;
			},
		},
		agentGrant: {
			create: async (args: { data: Record<string, unknown> }) => {
				state.agentGrants.push(args.data as unknown as StoredAgentGrant);
				return args.data;
			},
			deleteMany: async (args: { where: { agentId: string } }) => {
				state.agentGrants = state.agentGrants.filter(
					(grant) => grant.agentId !== args.where.agentId,
				);
				return { count: 1 };
			},
		},
		instanceMembership: {
			create: async (args: { data: Record<string, unknown> }) => {
				state.instanceMemberships.push(
					args.data as unknown as StoredInstanceMembership,
				);
				return args.data;
			},
			findFirst: async (args: {
				where: {
					instanceId: string;
					principalId: string;
					principalType: "agent";
				};
				select: { role: true; approvalStatus: true };
			}) =>
				state.instanceMemberships.find(
					(membership) =>
						membership.instanceId === args.where.instanceId &&
						membership.principalId === args.where.principalId &&
						membership.principalType === args.where.principalType,
				) ?? null,
		},
		groupMembership: {
			create: async (args: { data: Record<string, unknown> }) => {
				state.groupMemberships.push(
					args.data as unknown as StoredGroupMembership,
				);
				return args.data;
			},
			findMany: async (args: {
				where: {
					principalId: string;
					principalType: "agent";
					approvalStatus: "approved";
				};
				select: { groupId: true; role: true; approvalStatus: true };
			}) =>
				state.groupMemberships.filter(
					(membership) =>
						membership.principalId === args.where.principalId &&
						membership.principalType === args.where.principalType &&
						membership.approvalStatus === args.where.approvalStatus,
				),
		},
		communityGroup: {
			findMany: async (args: {
				where: { instanceId: string };
				orderBy: { createdAt: "asc" | "desc" };
				select: {
					id: true;
					name: true;
					description: true;
					visibilityMode: true;
				};
			}) =>
				state.groups
					.filter((group) => group.instanceId === args.where.instanceId)
					.sort((left, right) =>
						args.orderBy.createdAt === "asc"
							? left.createdAt.getTime() - right.createdAt.getTime()
							: right.createdAt.getTime() - left.createdAt.getTime(),
					)
					.map((group) => ({
						id: group.id,
						name: group.name,
						description: group.description,
						visibilityMode: group.visibilityMode,
					})),
			findFirst: async (args: {
				where: { id: string; instanceId: string };
				select: { id: true; name: true; visibilityMode: true };
			}) => {
				const group = state.groups.find(
					(candidate) =>
						candidate.id === args.where.id &&
						candidate.instanceId === args.where.instanceId,
				);
				return group
					? {
							id: group.id,
							name: group.name,
							visibilityMode: group.visibilityMode,
						}
					: null;
			},
		},
		post: {
			create: async (args: { data: Record<string, unknown> }) => {
				state.posts.push(args.data as unknown as StoredPost);
				return args.data;
			},
		},
		postEmbedding: {
			create: async (args: { data: Record<string, unknown> }) => {
				state.postEmbeddings.push(args.data);
				return args.data;
			},
		},
		moderationDecision: {
			create: async (args: { data: Record<string, unknown> }) => {
				state.moderationDecisions.push(args.data);
				return args.data;
			},
		},
		user: {
			findMany: async () => [],
		},
		auditLog: {
			create: async (args: { data: Record<string, unknown> }) => {
				state.auditLogs.push(args.data);
				return args.data;
			},
		},
	};

	return {
		db,
		state,
		nextId,
		addGroup(params: {
			id: string;
			instanceId?: string;
			name: string;
			description?: string;
			visibilityMode: string;
			createdAt?: Date;
		}) {
			state.groups.push({
				id: params.id,
				instanceId: params.instanceId ?? "instance-1",
				name: params.name,
				description: params.description ?? null,
				visibilityMode: params.visibilityMode,
				createdAt: params.createdAt ?? new Date("2026-04-06T10:00:00.000Z"),
				updatedAt: params.createdAt ?? new Date("2026-04-06T10:00:00.000Z"),
			});
		},
		async createAgent(params: {
			displayName?: string;
			displayLabel?: string;
			instanceRole?: "member" | "moderator" | "admin";
			groupMemberships?: Array<{
				groupId: string;
				role: "member" | "moderator" | "admin" | "owner";
			}>;
			grants?: Array<{
				resourceType: string;
				resourceId: string;
				scope: string;
			}>;
			token?: string;
		}) {
			return createAgent({
				instanceId: "instance-1",
				displayName: params.displayName ?? "Codex",
				displayLabel: params.displayLabel ?? "Codex agent",
				instanceRole: params.instanceRole ?? "member",
				groupMemberships: params.groupMemberships ?? [],
				grants: params.grants ?? [],
				db: db as never,
				now: new Date("2026-04-06T12:00:00.000Z"),
				generateId: () => nextId("id"),
				generateToken: () => params.token ?? `oga_${nextId("token")}`,
			});
		},
		authenticate: (request: Request) =>
			authenticateAgentRequest({
				request,
				db: db as never,
			}),
		writeAuditLog: async (params: Record<string, unknown>) => {
			state.auditLogs.push(params);
		},
		allowRateLimit: () => ({
			allowed: true,
			limit: 100,
			remaining: 99,
			resetAtMs: Date.UTC(2026, 3, 6, 12, 1, 0),
			retryAfterSeconds: 0,
		}),
	};
}

function createAuthorizedRequest(params: {
	path: string;
	token: string;
	method?: "GET" | "POST";
	body?: Record<string, unknown>;
	requestId: string;
}): Request {
	return new Request(`http://localhost${params.path}`, {
		method: params.method ?? "GET",
		headers: {
			authorization: `Bearer ${params.token}`,
			"content-type": "application/json",
			"x-request-id": params.requestId,
		},
		body: params.body ? JSON.stringify(params.body) : undefined,
	});
}

async function createGroupPostingAgent(
	harness: IntegrationHarness,
	params: {
		token: string;
		groupMemberships: Array<{
			groupId: string;
			role: "member" | "moderator" | "admin" | "owner";
		}>;
		grants: Array<{
			resourceType: string;
			resourceId: string;
			scope: string;
		}>;
	},
) {
	return harness.createAgent({
		token: params.token,
		groupMemberships: params.groupMemberships,
		grants: params.grants,
	});
}

test("agent API integration supports a Codex-style client flow", async () => {
	const harness = createIntegrationHarness();
	harness.addGroup({
		id: "group-1",
		name: "Core Group",
		visibilityMode: "private_invite_only",
	});
	const { token, agentId } = await createGroupPostingAgent(harness, {
		token: "oga_codex_flow",
		groupMemberships: [{ groupId: "group-1", role: "member" }],
		grants: [
			{
				resourceType: "group",
				resourceId: "group-1",
				scope: "group.read",
			},
			{
				resourceType: "group",
				resourceId: "group-1",
				scope: "group.post",
			},
		],
	});

	const meResponse = await loadAgentMe({
		request: createAuthorizedRequest({
			path: "/api/agents/v1/me",
			token,
			requestId: "req-integration-me",
		}),
		authenticate: ({ request }) => harness.authenticate(request),
		rateLimit: harness.allowRateLimit,
	});
	assert.equal(meResponse.status, 200);
	const meJson = (await meResponse.json()) as {
		data: {
			agent: { id: string };
			groupRoles: Array<{ groupId: string; role: string }>;
		};
	};
	assert.equal(meJson.data.agent.id, agentId);
	assert.deepEqual(meJson.data.groupRoles, [
		{
			groupId: "group-1",
			role: "member",
		},
	]);

	const groupsResponse = await loadAgentGroups({
		request: createAuthorizedRequest({
			path: "/api/agents/v1/groups",
			token,
			requestId: "req-integration-groups",
		}),
		authenticate: ({ request }) => harness.authenticate(request),
		db: harness.db as never,
		rateLimit: harness.allowRateLimit,
	});
	assert.equal(groupsResponse.status, 200);
	const groupsJson = (await groupsResponse.json()) as {
		data: {
			groups: Array<{ id: string; canPost: boolean }>;
		};
	};
	assert.deepEqual(groupsJson.data.groups, [
		{
			id: "group-1",
			name: "Core Group",
			visibilityMode: "private_invite_only",
			groupRole: "member",
			canPost: true,
		},
	]);

	const postResponse = await createAgentGroupPost({
		request: createAuthorizedRequest({
			path: "/api/agents/v1/groups/group-1/posts",
			token,
			method: "POST",
			body: { bodyText: "Hello from Codex integration" },
			requestId: "req-integration-post",
		}),
		groupId: "group-1",
		authenticate: ({ request }) => harness.authenticate(request),
		db: harness.db as never,
		rateLimit: harness.allowRateLimit,
		writeAuditLog: harness.writeAuditLog as never,
		now: new Date("2026-04-06T12:30:00.000Z"),
		generateId: () => harness.nextId("post"),
	});
	assert.equal(postResponse.status, 201);
	assert.equal(harness.state.posts.length, 1);
	assert.equal(harness.state.posts[0]?.authorType, "agent");
	assert.equal(harness.state.posts[0]?.groupId, "group-1");
	assert.equal(harness.state.auditLogs.length, 1);
});

test("agent API integration returns only granted private groups", async () => {
	const harness = createIntegrationHarness();
	harness.addGroup({
		id: "group-1",
		name: "Granted Group",
		visibilityMode: "private_invite_only",
	});
	harness.addGroup({
		id: "group-2",
		name: "Ungrantred Group",
		visibilityMode: "private_invite_only",
	});
	const { token } = await createGroupPostingAgent(harness, {
		token: "oga_private_group_read",
		groupMemberships: [
			{ groupId: "group-1", role: "member" },
			{ groupId: "group-2", role: "member" },
		],
		grants: [
			{
				resourceType: "group",
				resourceId: "group-1",
				scope: "group.read",
			},
		],
	});

	const response = await loadAgentGroups({
		request: createAuthorizedRequest({
			path: "/api/agents/v1/groups",
			token,
			requestId: "req-private-groups",
		}),
		authenticate: ({ request }) => harness.authenticate(request),
		db: harness.db as never,
		rateLimit: harness.allowRateLimit,
	});

	assert.equal(response.status, 200);
	const json = (await response.json()) as {
		data: { groups: Array<{ id: string }> };
	};
	assert.deepEqual(
		json.data.groups.map((group) => group.id),
		["group-1"],
	);
});

test("agent API integration blocks posting without group.post scope", async () => {
	const harness = createIntegrationHarness();
	harness.addGroup({
		id: "group-1",
		name: "Read Only Group",
		visibilityMode: "private_invite_only",
	});
	const { token } = await createGroupPostingAgent(harness, {
		token: "oga_no_group_post",
		groupMemberships: [{ groupId: "group-1", role: "member" }],
		grants: [
			{
				resourceType: "group",
				resourceId: "group-1",
				scope: "group.read",
			},
		],
	});

	const response = await createAgentGroupPost({
		request: createAuthorizedRequest({
			path: "/api/agents/v1/groups/group-1/posts",
			token,
			method: "POST",
			body: { bodyText: "This should not post" },
			requestId: "req-no-group-post",
		}),
		groupId: "group-1",
		authenticate: ({ request }) => harness.authenticate(request),
		db: harness.db as never,
		rateLimit: harness.allowRateLimit,
		writeAuditLog: harness.writeAuditLog as never,
	});

	assert.equal(response.status, 403);
	assert.deepEqual(await response.json(), {
		ok: false,
		meta: {
			requestId: "req-no-group-post",
		},
		error: {
			code: "forbidden",
			message: "Agent cannot post to this group.",
			details: {
				reason: "missing_scope",
			},
		},
	});
	assert.equal(harness.state.posts.length, 0);
});

test("agent API integration revokes old bearer tokens immediately after rotation", async () => {
	const harness = createIntegrationHarness();
	const created = await harness.createAgent({
		token: "oga_old_token",
		grants: [
			{
				resourceType: "instance",
				resourceId: "instance-1",
				scope: "instance.feed.read",
			},
		],
	});

	const initialResponse = await loadAgentMe({
		request: createAuthorizedRequest({
			path: "/api/agents/v1/me",
			token: created.token,
			requestId: "req-old-token-before-rotate",
		}),
		authenticate: ({ request }) => harness.authenticate(request),
		rateLimit: harness.allowRateLimit,
	});
	assert.equal(initialResponse.status, 200);

	const rotated = await rotateAgentToken({
		agentId: created.agentId,
		db: harness.db as never,
		now: new Date("2026-04-06T12:45:00.000Z"),
		generateToken: () => "oga_new_token",
	});
	assert.equal(rotated.token, "oga_new_token");

	const revokedResponse = await loadAgentMe({
		request: createAuthorizedRequest({
			path: "/api/agents/v1/me",
			token: created.token,
			requestId: "req-old-token-after-rotate",
		}),
		authenticate: ({ request }) => harness.authenticate(request),
		rateLimit: harness.allowRateLimit,
	});
	assert.equal(revokedResponse.status, 401);
	assert.deepEqual(await revokedResponse.json(), {
		ok: false,
		meta: {
			requestId: "req-old-token-after-rotate",
		},
		error: {
			code: "invalid_token",
			message: "Invalid agent token.",
		},
	});

	const replacementResponse = await loadAgentMe({
		request: createAuthorizedRequest({
			path: "/api/agents/v1/me",
			token: rotated.token,
			requestId: "req-new-token-after-rotate",
		}),
		authenticate: ({ request }) => harness.authenticate(request),
		rateLimit: harness.allowRateLimit,
	});
	assert.equal(replacementResponse.status, 200);
});

test("agent-authored integration content resolves agent identity for visible labeling", async () => {
	const harness = createIntegrationHarness();
	harness.addGroup({
		id: "group-1",
		name: "Visible Group",
		visibilityMode: "private_invite_only",
	});
	const { token, agentId } = await createGroupPostingAgent(harness, {
		token: "oga_visible_label",
		groupMemberships: [{ groupId: "group-1", role: "member" }],
		grants: [
			{
				resourceType: "group",
				resourceId: "group-1",
				scope: "group.post",
			},
		],
	});

	const response = await createAgentGroupPost({
		request: createAuthorizedRequest({
			path: "/api/agents/v1/groups/group-1/posts",
			token,
			method: "POST",
			body: { bodyText: "Agent-labeled post" },
			requestId: "req-visible-agent-label",
		}),
		groupId: "group-1",
		authenticate: ({ request }) => harness.authenticate(request),
		db: harness.db as never,
		rateLimit: harness.allowRateLimit,
		writeAuditLog: harness.writeAuditLog as never,
		now: new Date("2026-04-06T12:50:00.000Z"),
		generateId: () => harness.nextId("post"),
	});
	assert.equal(response.status, 201);
	const responseJson = (await response.json()) as {
		data: {
			post: {
				author: {
					type: string;
					displayName: string;
				};
			};
		};
	};
	assert.deepEqual(responseJson.data.post.author, {
		type: "agent",
		id: agentId,
		displayName: "Codex agent",
	});

	const createdPost = harness.state.posts.at(-1);
	assert.ok(createdPost);
	const authorMap = await loadPostAuthorSummaryMap({
		authors: [
			{
				id: createdPost.authorId,
				type: createdPost.authorType,
			},
		],
		db: harness.db as never,
	});
	const author = authorMap.get(agentId);
	assert.equal(author?.kind, "agent");
	assert.equal(author?.name, "Codex agent");
});
