import { randomBytes, randomUUID } from "node:crypto";
import { hashAgentToken } from "./agent-auth.server.ts";

type AgentServiceDb = {
	$transaction: <T>(callback: (trx: {
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
		agentMcpSession: {
			update: (args: {
				where: { id: string };
				data: Record<string, unknown>;
			}) => Promise<unknown>;
		};
		agentMcpAccessToken: {
			updateMany: (args: {
				where: { sessionId: string; revokedAt: null };
				data: Record<string, unknown>;
			}) => Promise<unknown>;
		};
		agentMcpRefreshToken: {
			updateMany: (args: {
				where: { sessionId: string; revokedAt: null };
				data: Record<string, unknown>;
			}) => Promise<unknown>;
		};
	}) => Promise<T>) => Promise<T>;
	agent: {
		findMany: (args: {
			where: Record<string, unknown>;
			orderBy: Array<Record<string, unknown>>;
			include: {
				grants: {
					orderBy: Array<Record<string, unknown>>;
				};
			};
		}) => Promise<AgentRecord[]>;
		update: (args: {
			where: { id: string };
			data: Record<string, unknown>;
		}) => Promise<unknown>;
	};
	agentMcpSession: {
		findMany: (args: {
			where: Record<string, unknown>;
			orderBy: Array<Record<string, unknown>>;
			select: Record<string, unknown>;
		}) => Promise<AgentMcpSessionSummary[]>;
	};
};

export type AgentGrantSummary = {
	id: string;
	resourceType: string;
	resourceId: string;
	scope: string;
	createdAt: Date;
	updatedAt: Date;
};

export type AgentSummary = {
	id: string;
	instanceId: string;
	createdByUserId: string | null;
	displayName: string;
	displayLabel: string | null;
	description: string | null;
	role: string;
	isEnabled: boolean;
	lastUsedAt: Date | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	grants: AgentGrantSummary[];
};

type AgentRecord = AgentSummary;

export type AgentMcpSessionSummary = {
	id: string;
	agentId: string;
	userId: string;
	clientId: string | null;
	expiresAt: Date;
	revokedAt: Date | null;
	lastUsedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	agent: {
		displayName: string;
		displayLabel: string | null;
	};
};

function isMissingAgentMcpStorageError(error: unknown): boolean {
	if (!error || typeof error !== "object") {
		return false;
	}

	const candidate = error as { code?: unknown; message?: unknown };
	if (candidate.code === "P2021") {
		return true;
	}

	const message =
		typeof candidate.message === "string" ? candidate.message : "";
	return (
		message.includes("agent_mcp_session") ||
		message.includes("agent_mcp_access_token") ||
		message.includes("agent_mcp_refresh_token")
	);
}

export type CreateAgentGrantInput = {
	resourceType: string;
	resourceId: string;
	scope: string;
};

export type CreateAgentGroupMembershipInput = {
	groupId: string;
	role: "member" | "moderator" | "admin" | "owner";
};

function normalizeGrantInputs(
	grants: CreateAgentGrantInput[],
): CreateAgentGrantInput[] {
	const seen = new Set<string>();
	const normalized: CreateAgentGrantInput[] = [];

	for (const grant of grants) {
		const resourceType = grant.resourceType.trim();
		const resourceId = grant.resourceId.trim();
		const scope = grant.scope.trim();
		if (!resourceType || !resourceId || !scope) {
			throw new Error(
				"Agent grants require resourceType, resourceId, and scope.",
			);
		}

		const key = `${resourceType}\u0000${resourceId}\u0000${scope}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		normalized.push({ resourceType, resourceId, scope });
	}

	return normalized.sort((left, right) => {
		if (left.resourceType !== right.resourceType) {
			return left.resourceType.localeCompare(right.resourceType);
		}
		if (left.resourceId !== right.resourceId) {
			return left.resourceId.localeCompare(right.resourceId);
		}
		return left.scope.localeCompare(right.scope);
	});
}

export function generateAgentToken(params?: {
	randomBytesFn?: (size: number) => Buffer;
}): string {
	return `oga_${(params?.randomBytesFn ?? randomBytes)(24).toString("base64url")}`;
}

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
	const db = (params.db ??
		(await import("./db.server.ts")).getDb()) as AgentServiceDb;
	const instanceId =
		params.instanceId ??
		(await import("./setup.service.server.ts").then((module) =>
			module.getSetupInstanceId(),
		));
	if (!instanceId) {
		throw new Error("Setup must be completed before creating an agent.");
	}

	const now = params.now ?? new Date();
	const generateId = params.generateId ?? randomUUID;
	const token = (params.generateToken ?? (() => generateAgentToken()))();
	const agentId = generateId();
	const grants = params.grants ?? [];
	const groupMemberships = params.groupMemberships ?? [];

	await db.$transaction(async (trx: {
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
	});

	return { agentId, token };
}

export async function rotateAgentToken(params: {
	agentId: string;
	db?: AgentServiceDb;
	now?: Date;
	generateToken?: () => string;
}): Promise<{ agentId: string; token: string }> {
	const db = params.db ?? (await import("./db.server.ts")).getDb();
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
	const db = params.db ?? (await import("./db.server.ts")).getDb();
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
	const db = (params?.db ??
		(await import("./db.server.ts")).getDb()) as AgentServiceDb;
	const instanceId =
		params?.instanceId ??
		(await import("./setup.service.server.ts").then((module) =>
			module.getSetupInstanceId(),
		));
	if (!instanceId) {
		throw new Error("Setup must be completed before listing agents.");
	}

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

export async function listAgentMcpSessions(params?: {
	instanceId?: string;
	db?: AgentServiceDb;
}): Promise<AgentMcpSessionSummary[]> {
	const db = (params?.db ??
		(await import("./db.server.ts")).getDb()) as AgentServiceDb;
	const instanceId =
		params?.instanceId ??
		(await import("./setup.service.server.ts").then((module) =>
			module.getSetupInstanceId(),
		));
	if (!instanceId) {
		throw new Error("Setup must be completed before listing MCP sessions.");
	}

	return db.agentMcpSession.findMany({
		where: {
			agent: {
				instanceId,
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
}

export async function setAgentGrants(params: {
	agentId: string;
	grants: CreateAgentGrantInput[];
	db?: AgentServiceDb;
	now?: Date;
	generateId?: () => string;
}): Promise<{ agentId: string; grants: AgentGrantSummary[] }> {
	const db = (params.db ??
		(await import("./db.server.ts")).getDb()) as AgentServiceDb;
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

export async function revokeAgentMcpSessionsForAgent(params: {
	agentId: string;
	db?: AgentServiceDb;
	now?: Date;
}): Promise<{ agentId: string; revokedSessionIds: string[] }> {
	const db = (params.db ??
		(await import("./db.server.ts")).getDb()) as AgentServiceDb;
	const now = params.now ?? new Date();
	const sessions = await db.agentMcpSession.findMany({
		where: {
			agentId: params.agentId,
			revokedAt: null,
		},
		orderBy: [{ createdAt: "asc" }, { id: "asc" }],
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

	for (const session of sessions) {
		await revokeAgentMcpSession({
			sessionId: session.id,
			db,
			now,
		});
	}

	return {
		agentId: params.agentId,
		revokedSessionIds: sessions.map((session) => session.id),
	};
}

export async function revokeAgentMcpSession(params: {
	sessionId: string;
	db?: AgentServiceDb;
	now?: Date;
}): Promise<{ sessionId: string; revoked: true }> {
	const db = (params.db ??
		(await import("./db.server.ts")).getDb()) as AgentServiceDb;
	const now = params.now ?? new Date();

	await db.$transaction(async (trx) => {
		await trx.agentMcpSession.update({
			where: { id: params.sessionId },
			data: {
				revokedAt: now,
				updatedAt: now,
			},
		});
		await trx.agentMcpAccessToken.updateMany({
			where: {
				sessionId: params.sessionId,
				revokedAt: null,
			},
			data: {
				revokedAt: now,
			},
		});
		await trx.agentMcpRefreshToken.updateMany({
			where: {
				sessionId: params.sessionId,
				revokedAt: null,
			},
			data: {
				revokedAt: now,
			},
		});
	});

	return {
		sessionId: params.sessionId,
		revoked: true,
	};
}
