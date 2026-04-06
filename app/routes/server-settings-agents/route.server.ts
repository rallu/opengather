import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { writeAuditLogSafely } from "../../server/audit-log.service.server.ts";
import {
	createAgent,
	disableAgent,
	listAgents,
	listAgentMcpSessions,
	revokeAgentMcpSession,
	rotateAgentToken,
	setAgentGrants,
	type AgentMcpSessionSummary,
	type AgentSummary,
} from "../../server/agent.service.server.ts";
import {
	canManageInstance,
	getViewerContext as getPermissionsViewerContext,
} from "../../server/permissions.server.ts";
import { getPublicOrigin } from "../../server/request-origin.server.ts";

type ViewerContext = Awaited<ReturnType<typeof getPermissionsViewerContext>>;

export type ServerSettingsAgentsLoaderData = {
	authUser: ViewerContext["authUser"];
	viewerRole: ViewerContext["viewerRole"];
	setup: ViewerContext["setup"];
	baseUrl: string;
	agents: AgentSummary[];
	sessions: AgentMcpSessionSummary[];
	mcpSessionsAvailable: boolean;
};

export type ServerSettingsAgentsActionData =
	| {
			ok: true;
			action: "create-agent";
			agentId: string;
			token: string;
			baseUrl: string;
	  }
	| {
			ok: true;
			action: "disable-agent";
			agentId: string;
	  }
	| {
			ok: true;
			action: "rotate-agent";
			agentId: string;
			token: string;
			baseUrl: string;
	  }
	| {
			ok: true;
			action: "update-grants";
			agentId: string;
			scopes: string[];
	  }
	| {
			ok: true;
			action: "revoke-session";
			sessionId: string;
	  }
	| {
			ok: false;
			action?:
				| "create-agent"
				| "disable-agent"
				| "rotate-agent"
				| "update-grants"
				| "revoke-session";
			error: string;
	  }
	| undefined;

async function resolveViewerRole(params: { request: Request }): Promise<{
	authUser: ViewerContext["authUser"];
	setup: ViewerContext["setup"];
	viewerRole: ViewerContext["viewerRole"];
}> {
	return getPermissionsViewerContext({ request: params.request });
}

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

function parseRequestedScopes(formData: FormData): string[] {
	const scopes: string[] = [];
	if (String(formData.get("scope_instance_feed_read") ?? "") === "on") {
		scopes.push("instance.feed.read");
	}
	if (String(formData.get("scope_instance_feed_post") ?? "") === "on") {
		scopes.push("instance.feed.post");
	}
	if (String(formData.get("scope_instance_feed_reply") ?? "") === "on") {
		scopes.push("instance.feed.reply");
	}
	if (
		String(formData.get("scope_instance_notifications_create") ?? "") === "on"
	) {
		scopes.push("instance.notifications.create");
	}
	return scopes;
}

export async function action(
	params: ActionFunctionArgs,
	deps?: {
		resolveViewerRole?: typeof resolveViewerRole;
		createAgent?: typeof createAgent;
		disableAgent?: typeof disableAgent;
		revokeAgentMcpSession?: typeof revokeAgentMcpSession;
		rotateAgentToken?: typeof rotateAgentToken;
		setAgentGrants?: typeof setAgentGrants;
		writeAuditLog?: typeof writeAuditLogSafely;
	},
): Promise<ServerSettingsAgentsActionData> {
	const resolveViewer = deps?.resolveViewerRole ?? resolveViewerRole;

	try {
		const { authUser, viewerRole, setup } = await resolveViewer({
			request: params.request,
		});
		if (!authUser) {
			return { ok: false, error: "Sign in required." };
		}
		if (!canManageInstance({ viewerRole }).allowed) {
			return { ok: false, error: "Admin access required." };
		}
		if (!setup.isSetup || !setup.instance) {
			return { ok: false, error: "Run setup before creating agents." };
		}

		const formData = await params.request.formData();
		const actionType = String(formData.get("_action") ?? "");
		if (
			actionType !== "create-agent" &&
			actionType !== "disable-agent" &&
			actionType !== "rotate-agent" &&
			actionType !== "update-grants" &&
			actionType !== "revoke-session"
		) {
			return { ok: false, error: "Unsupported action." };
		}
		if (actionType === "disable-agent") {
			const agentId = String(formData.get("agentId") ?? "").trim();
			if (!agentId) {
				return {
					ok: false,
					action: "disable-agent",
					error: "Agent ID is required.",
				};
			}

			await (deps?.disableAgent ?? disableAgent)({
				agentId,
			});
			await (deps?.writeAuditLog ?? writeAuditLogSafely)({
				action: "agent.disable",
				actor: { type: "user", id: authUser.id },
				resourceType: "agent",
				resourceId: agentId,
				request: params.request,
				payload: {
					outcome: "success",
				},
			});

			return {
				ok: true,
				action: "disable-agent",
				agentId,
			};
		}
		if (actionType === "rotate-agent") {
			const agentId = String(formData.get("agentId") ?? "").trim();
			if (!agentId) {
				return {
					ok: false,
					action: "rotate-agent",
					error: "Agent ID is required.",
				};
			}

			const { token } = await (deps?.rotateAgentToken ?? rotateAgentToken)({
				agentId,
			});
			await (deps?.writeAuditLog ?? writeAuditLogSafely)({
				action: "agent.rotate_secret",
				actor: { type: "user", id: authUser.id },
				resourceType: "agent",
				resourceId: agentId,
				request: params.request,
				payload: {
					outcome: "success",
				},
			});

			return {
				ok: true,
				action: "rotate-agent",
				agentId,
				token,
				baseUrl: getPublicOrigin(params.request),
			};
		}
		if (actionType === "update-grants") {
			const agentId = String(formData.get("agentId") ?? "").trim();
			if (!agentId) {
				return {
					ok: false,
					action: "update-grants",
					error: "Agent ID is required.",
				};
			}

			const scopes = parseRequestedScopes(formData);
			if (scopes.length === 0) {
				return {
					ok: false,
					action: "update-grants",
					error: "Select at least one scope.",
				};
			}

			await (deps?.setAgentGrants ?? setAgentGrants)({
				agentId,
				grants: scopes.map((scope) => ({
					resourceType: "instance",
					resourceId: setup.instance!.id,
					scope,
				})),
			});
			await (deps?.writeAuditLog ?? writeAuditLogSafely)({
				action: "agent.update_grants",
				actor: { type: "user", id: authUser.id },
				resourceType: "agent",
				resourceId: agentId,
				request: params.request,
				payload: {
					outcome: "success",
					scopes,
				},
			});

			return {
				ok: true,
				action: "update-grants",
				agentId,
				scopes,
			};
		}
		if (actionType === "revoke-session") {
			const sessionId = String(formData.get("sessionId") ?? "").trim();
			if (!sessionId) {
				return {
					ok: false,
					action: "revoke-session",
					error: "Session ID is required.",
				};
			}

			await (deps?.revokeAgentMcpSession ?? revokeAgentMcpSession)({
				sessionId,
			});
			await (deps?.writeAuditLog ?? writeAuditLogSafely)({
				action: "agent.revoke_mcp_session",
				actor: { type: "user", id: authUser.id },
				resourceType: "agent_mcp_session",
				resourceId: sessionId,
				request: params.request,
				payload: {
					outcome: "success",
				},
			});

			return {
				ok: true,
				action: "revoke-session",
				sessionId,
			};
		}

		const displayName = String(formData.get("displayName") ?? "").trim();
		const displayLabel = String(formData.get("displayLabel") ?? "").trim();
		const requestedRole = String(formData.get("instanceRole") ?? "member");
		if (!displayName) {
			return {
				ok: false,
				action: "create-agent",
				error: "Display name is required.",
			};
		}
		if (
			requestedRole !== "member" &&
			requestedRole !== "moderator" &&
			requestedRole !== "admin"
		) {
			return {
				ok: false,
				action: "create-agent",
				error: "Invalid instance role.",
			};
		}

		const scopes = parseRequestedScopes(formData);
		if (scopes.length === 0) {
			return {
				ok: false,
				action: "create-agent",
				error: "Select at least one scope.",
			};
		}

		const { agentId, token } = await (deps?.createAgent ?? createAgent)({
			instanceId: setup.instance.id,
			createdByUserId: authUser.id,
			displayName,
			displayLabel: displayLabel || undefined,
			instanceRole: requestedRole,
			grants: scopes.map((scope) => ({
				resourceType: "instance",
				resourceId: setup.instance!.id,
				scope,
			})),
		});

		await (deps?.writeAuditLog ?? writeAuditLogSafely)({
			action: "agent.create",
			actor: { type: "user", id: authUser.id },
			resourceType: "agent",
			resourceId: agentId,
			request: params.request,
			payload: {
				displayName,
				displayLabel: displayLabel || undefined,
				instanceRole: requestedRole,
				scopes,
			},
		});

		return {
			ok: true,
			action: "create-agent",
			agentId,
			token,
			baseUrl: getPublicOrigin(params.request),
		};
	} catch (error) {
		return {
			ok: false,
			action: "create-agent",
			error: `Failed to create agent: ${
				error instanceof Error ? error.message : "unknown error"
			}`,
		};
	}
}

export async function loader(
	params: LoaderFunctionArgs,
	deps?: {
		resolveViewerRole?: typeof resolveViewerRole;
		listAgents?: typeof listAgents;
		listAgentMcpSessions?: typeof listAgentMcpSessions;
	},
): Promise<ServerSettingsAgentsLoaderData> {
	try {
		const { authUser, setup, viewerRole } = await (
			deps?.resolveViewerRole ?? resolveViewerRole
		)({
			request: params.request,
		});
		let agents: AgentSummary[] = [];
		let sessions: AgentMcpSessionSummary[] = [];
		let mcpSessionsAvailable = true;
		if (
			setup.isSetup &&
			setup.instance &&
			canManageInstance({ viewerRole }).allowed
		) {
			agents = await (deps?.listAgents ?? listAgents)({
				instanceId: setup.instance.id,
			});
			try {
				sessions = await (deps?.listAgentMcpSessions ?? listAgentMcpSessions)({
					instanceId: setup.instance.id,
				});
			} catch (error) {
				if (!isMissingAgentMcpStorageError(error)) {
					throw error;
				}
				sessions = [];
				mcpSessionsAvailable = false;
			}
		}

		return {
			authUser,
			viewerRole,
			setup,
			baseUrl: getPublicOrigin(params.request),
			agents,
			sessions,
			mcpSessionsAvailable,
		};
	} catch {
		return {
			authUser: null,
			viewerRole: "guest",
			setup: { isSetup: false },
			baseUrl: getPublicOrigin(params.request),
			agents: [],
			sessions: [],
			mcpSessionsAvailable: false,
		};
	}
}
