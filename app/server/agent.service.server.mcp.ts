import type {
	AgentMcpSessionSummary,
	AgentServiceDb,
} from "./agent.service.server.shared.ts";
import { getDb } from "./db.server.ts";
import { resolveAgentInstanceId } from "./agent.service.server.shared.ts";

export async function listAgentMcpSessions(params?: {
	instanceId?: string;
	db?: AgentServiceDb;
}): Promise<AgentMcpSessionSummary[]> {
	const db = (params?.db ?? getDb()) as AgentServiceDb;
	const instanceId = await resolveAgentInstanceId({
		instanceId: params?.instanceId,
	});

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

export async function revokeAgentMcpSession(params: {
	sessionId: string;
	db?: AgentServiceDb;
	now?: Date;
}): Promise<{ sessionId: string; revoked: true }> {
	const db = (params.db ?? getDb()) as AgentServiceDb;
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

export async function revokeAgentMcpSessionsForAgent(params: {
	agentId: string;
	db?: AgentServiceDb;
	now?: Date;
}): Promise<{ agentId: string; revokedSessionIds: string[] }> {
	const db = (params.db ?? getDb()) as AgentServiceDb;
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
