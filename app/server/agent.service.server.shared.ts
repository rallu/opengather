import { randomBytes } from "node:crypto";
import { getSetupInstanceId } from "./setup.service.server.ts";

export type AgentServiceDb = {
	$transaction: <T>(
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
				deleteMany: (args: { where: { agentId: string } }) => Promise<unknown>;
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
		}) => Promise<T>,
	) => Promise<T>;
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

export type AgentRecord = AgentSummary;

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

export type CreateAgentGrantInput = {
	resourceType: string;
	resourceId: string;
	scope: string;
};

export type CreateAgentGroupMembershipInput = {
	groupId: string;
	role: "member" | "moderator" | "admin" | "owner";
};

export function isMissingAgentMcpStorageError(error: unknown): boolean {
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

export function normalizeGrantInputs(
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

export async function resolveAgentInstanceId(params?: {
	instanceId?: string;
}): Promise<string> {
	const instanceId = params?.instanceId ?? (await getSetupInstanceId());
	if (!instanceId) {
		throw new Error("Setup must be completed before continuing.");
	}
	return instanceId;
}
