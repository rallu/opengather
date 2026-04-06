import { createHash } from "node:crypto";
import {
	createAgentGrantIndex,
	createAgentSubjectContext,
} from "./permissions.server.ts";
import {
	resolveGroupRoleFromMembership,
	resolveViewerRoleFromMembership,
	type GroupRole,
	type SubjectContext,
	type ViewerRole,
} from "./permissions.server/shared.ts";

export type AgentGrantRecord = {
	id: string;
	resourceType: string;
	resourceId: string;
	scope: string;
};

export type AgentAuthRecord = {
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
	grants: AgentGrantRecord[];
};

type AgentMembershipRecord = {
	role: string;
	approvalStatus: string;
};

type AgentGroupMembershipRecord = AgentMembershipRecord & {
	groupId: string;
};

type AgentAuthDb = {
	agent: {
		findUnique: (args: {
			where: { apiKeyHash: string };
			select: Record<string, unknown>;
		}) => Promise<AgentAuthRecord | null>;
		update: (args: {
			where: { id: string };
			data: { lastUsedAt: Date };
		}) => Promise<unknown>;
	};
	instanceMembership: {
		findFirst: (args: {
			where: {
				instanceId: string;
				principalId: string;
				principalType: "agent";
			};
			select: { role: true; approvalStatus: true };
		}) => Promise<AgentMembershipRecord | null>;
	};
	groupMembership: {
		findMany: (args: {
			where: {
				principalId: string;
				principalType: "agent";
				approvalStatus: "approved";
			};
			select: { groupId: true; role: true; approvalStatus: true };
		}) => Promise<AgentGroupMembershipRecord[]>;
	};
};

export type AgentAuthFailureCode =
	| "missing_authorization_header"
	| "invalid_authorization_header"
	| "invalid_token"
	| "disabled_agent";

export type AgentAuthResult =
	| {
			ok: false;
			code: AgentAuthFailureCode;
			message: string;
	  }
	| {
			ok: true;
			agent: AgentAuthRecord;
			subjectContext: SubjectContext;
			instanceRole: ViewerRole;
			groupRoles: ReadonlyMap<string, GroupRole>;
	  };

export function hashAgentToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export function parseAgentBearerToken(params: {
	request: Request;
}): {
	ok: true;
	token: string;
} | {
	ok: false;
	code: "missing_authorization_header" | "invalid_authorization_header";
	message: string;
} {
	const header = params.request.headers.get("authorization");
	if (!header) {
		return {
			ok: false,
			code: "missing_authorization_header",
			message: "Missing Authorization header.",
		};
	}

	const match = /^Bearer\s+(.+)$/i.exec(header.trim());
	if (!match || !match[1]) {
		return {
			ok: false,
			code: "invalid_authorization_header",
			message: "Authorization header must use Bearer token format.",
		};
	}

	return {
		ok: true,
		token: match[1].trim(),
	};
}

export async function authenticateAgentRequest(params: {
	request: Request;
	db?: AgentAuthDb;
	now?: Date;
	updateLastUsedAt?: boolean;
}): Promise<AgentAuthResult> {
	const parsed = parseAgentBearerToken({ request: params.request });
	if (!parsed.ok) {
		return parsed;
	}

	const db = params.db ?? (await import("./db.server.ts")).getDb();
	const tokenHash = hashAgentToken(parsed.token);
	const agent = await db.agent.findUnique({
		where: { apiKeyHash: tokenHash },
		select: {
			id: true,
			instanceId: true,
			createdByUserId: true,
			displayName: true,
			displayLabel: true,
			description: true,
			role: true,
			isEnabled: true,
			lastUsedAt: true,
			deletedAt: true,
			grants: {
				select: {
					id: true,
					resourceType: true,
					resourceId: true,
					scope: true,
				},
			},
		},
	});

	if (!agent) {
		return {
			ok: false,
			code: "invalid_token",
			message: "Invalid agent token.",
		};
	}

	if (!agent.isEnabled || agent.deletedAt) {
		return {
			ok: false,
			code: "disabled_agent",
			message: "Agent is disabled.",
		};
	}

	const [instanceMembership, groupMemberships] = await Promise.all([
		db.instanceMembership.findFirst({
			where: {
				instanceId: agent.instanceId,
				principalId: agent.id,
				principalType: "agent",
			},
			select: {
				role: true,
				approvalStatus: true,
			},
		}),
		db.groupMembership.findMany({
			where: {
				principalId: agent.id,
				principalType: "agent",
				approvalStatus: "approved",
			},
			select: {
				groupId: true,
				role: true,
				approvalStatus: true,
			},
		}),
	]);

	const instanceRole = resolveViewerRoleFromMembership(instanceMembership);
	const groupRoles = new Map(
		groupMemberships.map((membership) => [
			membership.groupId,
			resolveGroupRoleFromMembership(membership),
		]),
	);
	const subjectContext = createAgentSubjectContext({
		agentId: agent.id,
		instanceRole,
		groupRoles,
		scopes: agent.grants.map((grant) => grant.scope),
		resourceScopes: createAgentGrantIndex({
			grants: agent.grants,
		}),
	});

	if (params.updateLastUsedAt !== false) {
		await db.agent.update({
			where: { id: agent.id },
			data: { lastUsedAt: params.now ?? new Date() },
		});
	}

	return {
		ok: true,
		agent,
		subjectContext,
		instanceRole,
		groupRoles,
	};
}
