import { randomUUID } from "node:crypto";
import { getDb } from "./db.server.ts";
import { revokeAgentMcpSessionsForAgent } from "./agent.service.server.mcp.ts";
import {
	type AgentGrantSummary,
	type AgentServiceDb,
	type AgentSummary,
	type CreateAgentGrantInput,
	type CreateAgentGroupMembershipInput,
	generateAgentToken,
	isMissingAgentMcpStorageError,
	normalizeGrantInputs,
	resolveAgentInstanceId,
} from "./agent.service.server.shared.ts";
import { hashAgentToken } from "./agent-auth.server.ts";

export {
	listAgentMcpSessions,
	revokeAgentMcpSession,
	revokeAgentMcpSessionsForAgent,
} from "./agent.service.server.mcp.ts";
export type {
	AgentGrantSummary,
	AgentMcpSessionSummary,
	AgentServiceDb,
	AgentSummary,
	CreateAgentGrantInput,
	CreateAgentGroupMembershipInput,
} from "./agent.service.server.shared.ts";
export {
	generateAgentToken,
	isMissingAgentMcpStorageError,
} from "./agent.service.server.shared.ts";

export async function createAgent(params: {
	instanceId?: string;
	createdByUserId?: string;
	displayName: string;
	displayLabel?: string;
	description?: string;
	role?: string;
	instanceRole?: "member" | "moderator" | "admin";
	groupMemberships?: CreateAgentGroupMembershipInput[];
	grants?: CreateAgentGrantInput[];
	db?: AgentServiceDb;
	now?: Date;
	generateId?: () => string;
	generateToken?: () => string;
}): Promise<{ agentId: string; token: string }> {
	const db = (params.db ?? getDb()) as AgentServiceDb;
	const instanceId = await resolveAgentInstanceId({
		instanceId: params.instanceId,
	});

	const now = params.now ?? new Date();
	const generateId = params.generateId ?? randomUUID;
	const token = (params.generateToken ?? (() => generateAgentToken()))();
	const agentId = generateId();
	const grants = params.grants ?? [];
	const groupMemberships = params.groupMemberships ?? [];

	await db.$transaction(
		async (trx: {
			agent: {
				create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
				update: (args: {
					where: { id: string };
					data: Record<string, unknown>;
				}) => Promise<unknown>;
			};
			agentGrant: {
				create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
				deleteMany: (args: { where: { agentId: string } }) => Promise<unknown>;
			};
			instanceMembership: {
				create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
			};
			groupMembership: {
				create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
			};
		}) => {
			await trx.agent.create({
				data: {
					id: agentId,
					instanceId,
					createdByUserId: params.createdByUserId ?? null,
					displayName: params.displayName.trim(),
					displayLabel: params.displayLabel?.trim() || null,
					description: params.description?.trim() || null,
					role: params.role?.trim() || "assistant",
					apiKeyHash: hashAgentToken(token),
					isEnabled: true,
					lastUsedAt: null,
					deletedAt: null,
					createdAt: now,
					updatedAt: now,
				},
			});

			if (params.instanceRole) {
				await trx.instanceMembership.create({
					data: {
						id: generateId(),
						instanceId,
						principalId: agentId,
						principalType: "agent",
						role: params.instanceRole,
						approvalStatus: "approved",
						createdAt: now,
						updatedAt: now,
					},
				});
			}

			for (const membership of groupMemberships) {
				await trx.groupMembership.create({
					data: {
						id: generateId(),
						groupId: membership.groupId,
						principalId: agentId,
						principalType: "agent",
						role: membership.role,
						approvalStatus: "approved",
						createdAt: now,
						updatedAt: now,
					},
				});
			}

			for (const grant of grants) {
				await trx.agentGrant.create({
					data: {
						id: generateId(),
						agentId,
						resourceType: grant.resourceType,
						resourceId: grant.resourceId,
						scope: grant.scope,
						createdAt: now,
						updatedAt: now,
					},
				});
			}
		},
	);

	return { agentId, token };
}

export async function rotateAgentToken(params: {
	agentId: string;
	db?: AgentServiceDb;
	now?: Date;
	generateToken?: () => string;
}): Promise<{ agentId: string; token: string }> {
	const db = params.db ?? getDb();
	const token = (params.generateToken ?? (() => generateAgentToken()))();
	await db.agent.update({
		where: { id: params.agentId },
		data: {
			apiKeyHash: hashAgentToken(token),
			updatedAt: params.now ?? new Date(),
		},
	});
	return {
		agentId: params.agentId,
		token,
	};
}

export async function disableAgent(params: {
	agentId: string;
	db?: AgentServiceDb;
	now?: Date;
}): Promise<{ agentId: string; disabled: true }> {
	const db = params.db ?? getDb();
	const now = params.now ?? new Date();
	await db.agent.update({
		where: { id: params.agentId },
		data: {
			isEnabled: false,
			updatedAt: now,
		},
	});
	try {
		await revokeAgentMcpSessionsForAgent({
			agentId: params.agentId,
			db: db as AgentServiceDb,
			now,
		});
	} catch (error) {
		if (!isMissingAgentMcpStorageError(error)) {
			throw error;
		}
	}
	return {
		agentId: params.agentId,
		disabled: true,
	};
}

export async function listAgents(params?: {
	instanceId?: string;
	db?: AgentServiceDb;
}): Promise<AgentSummary[]> {
	const db = (params?.db ?? getDb()) as AgentServiceDb;
	const instanceId = await resolveAgentInstanceId({
		instanceId: params?.instanceId,
	});

	return db.agent.findMany({
		where: {
			instanceId,
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
}

export async function setAgentGrants(params: {
	agentId: string;
	grants: CreateAgentGrantInput[];
	db?: AgentServiceDb;
	now?: Date;
	generateId?: () => string;
}): Promise<{ agentId: string; grants: AgentGrantSummary[] }> {
	const db = (params.db ?? getDb()) as AgentServiceDb;
	const now = params.now ?? new Date();
	const generateId = params.generateId ?? randomUUID;
	const grants = normalizeGrantInputs(params.grants);
	const createdGrants: AgentGrantSummary[] = [];

	await db.$transaction(async (trx) => {
		await trx.agentGrant.deleteMany({
			where: { agentId: params.agentId },
		});

		for (const grant of grants) {
			const grantId = generateId();
			await trx.agentGrant.create({
				data: {
					id: grantId,
					agentId: params.agentId,
					resourceType: grant.resourceType,
					resourceId: grant.resourceId,
					scope: grant.scope,
					createdAt: now,
					updatedAt: now,
				},
			});
			createdGrants.push({
				id: grantId,
				resourceType: grant.resourceType,
				resourceId: grant.resourceId,
				scope: grant.scope,
				createdAt: now,
				updatedAt: now,
			});
		}

		await trx.agent.update({
			where: { id: params.agentId },
			data: {
				updatedAt: now,
			},
		});
	});
	try {
		await revokeAgentMcpSessionsForAgent({
			agentId: params.agentId,
			db,
			now,
		});
	} catch (error) {
		if (!isMissingAgentMcpStorageError(error)) {
			throw error;
		}
	}

	return {
		agentId: params.agentId,
		grants: createdGrants,
	};
}
