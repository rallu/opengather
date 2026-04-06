import {
	createAgent,
	disableAgent,
	revokeAgentMcpSession,
	rotateAgentToken,
	setAgentGrants,
} from "../../server/agent.service.server.ts";
import { writeAuditLogSafely } from "../../server/audit-log.service.server.ts";
import { getPublicOrigin } from "../../server/request-origin.server.ts";
import {
	parseRequestedScopes,
	resolveViewerRole,
	type ServerSettingsAgentsActionData,
} from "./route.server.shared.ts";

type ActionDeps = {
	resolveViewerRole?: typeof resolveViewerRole;
	createAgent?: typeof createAgent;
	disableAgent?: typeof disableAgent;
	revokeAgentMcpSession?: typeof revokeAgentMcpSession;
	rotateAgentToken?: typeof rotateAgentToken;
	setAgentGrants?: typeof setAgentGrants;
	writeAuditLog?: typeof writeAuditLogSafely;
};

type ActionContext = {
	authUser: NonNullable<
		Awaited<ReturnType<typeof resolveViewerRole>>["authUser"]
	>;
	instanceId: string;
	request: Request;
	writeAuditLog: typeof writeAuditLogSafely;
};

function toInstanceGrants(instanceId: string, scopes: string[]) {
	return scopes.map((scope) => ({
		resourceType: "instance" as const,
		resourceId: instanceId,
		scope,
	}));
}

async function handleDisableAgent(params: {
	formData: FormData;
	context: ActionContext;
	disableAgentAction: typeof disableAgent;
}): Promise<ServerSettingsAgentsActionData> {
	const agentId = String(params.formData.get("agentId") ?? "").trim();
	if (!agentId) {
		return {
			ok: false,
			action: "disable-agent",
			error: "Agent ID is required.",
		};
	}

	await params.disableAgentAction({ agentId });
	await params.context.writeAuditLog({
		action: "agent.disable",
		actor: { type: "user", id: params.context.authUser.id },
		resourceType: "agent",
		resourceId: agentId,
		request: params.context.request,
		payload: { outcome: "success" },
	});

	return {
		ok: true,
		action: "disable-agent",
		agentId,
	};
}

async function handleRotateAgent(params: {
	formData: FormData;
	context: ActionContext;
	rotateAgentAction: typeof rotateAgentToken;
}): Promise<ServerSettingsAgentsActionData> {
	const agentId = String(params.formData.get("agentId") ?? "").trim();
	if (!agentId) {
		return {
			ok: false,
			action: "rotate-agent",
			error: "Agent ID is required.",
		};
	}

	const { token } = await params.rotateAgentAction({ agentId });
	await params.context.writeAuditLog({
		action: "agent.rotate_secret",
		actor: { type: "user", id: params.context.authUser.id },
		resourceType: "agent",
		resourceId: agentId,
		request: params.context.request,
		payload: { outcome: "success" },
	});

	return {
		ok: true,
		action: "rotate-agent",
		agentId,
		token,
		baseUrl: getPublicOrigin(params.context.request),
	};
}

async function handleUpdateGrants(params: {
	formData: FormData;
	context: ActionContext;
	setAgentGrantsAction: typeof setAgentGrants;
}): Promise<ServerSettingsAgentsActionData> {
	const agentId = String(params.formData.get("agentId") ?? "").trim();
	if (!agentId) {
		return {
			ok: false,
			action: "update-grants",
			error: "Agent ID is required.",
		};
	}

	const scopes = parseRequestedScopes(params.formData);
	if (scopes.length === 0) {
		return {
			ok: false,
			action: "update-grants",
			error: "Select at least one scope.",
		};
	}

	await params.setAgentGrantsAction({
		agentId,
		grants: toInstanceGrants(params.context.instanceId, scopes),
	});
	await params.context.writeAuditLog({
		action: "agent.update_grants",
		actor: { type: "user", id: params.context.authUser.id },
		resourceType: "agent",
		resourceId: agentId,
		request: params.context.request,
		payload: { outcome: "success", scopes },
	});

	return {
		ok: true,
		action: "update-grants",
		agentId,
		scopes,
	};
}

async function handleRevokeSession(params: {
	formData: FormData;
	context: ActionContext;
	revokeSessionAction: typeof revokeAgentMcpSession;
}): Promise<ServerSettingsAgentsActionData> {
	const sessionId = String(params.formData.get("sessionId") ?? "").trim();
	if (!sessionId) {
		return {
			ok: false,
			action: "revoke-session",
			error: "Session ID is required.",
		};
	}

	await params.revokeSessionAction({ sessionId });
	await params.context.writeAuditLog({
		action: "agent.revoke_mcp_session",
		actor: { type: "user", id: params.context.authUser.id },
		resourceType: "agent_mcp_session",
		resourceId: sessionId,
		request: params.context.request,
		payload: { outcome: "success" },
	});

	return {
		ok: true,
		action: "revoke-session",
		sessionId,
	};
}

async function handleCreateAgent(params: {
	formData: FormData;
	context: ActionContext;
	createAgentAction: typeof createAgent;
}): Promise<ServerSettingsAgentsActionData> {
	const displayName = String(params.formData.get("displayName") ?? "").trim();
	const displayLabel = String(params.formData.get("displayLabel") ?? "").trim();
	const requestedRole = String(params.formData.get("instanceRole") ?? "member");
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

	const scopes = parseRequestedScopes(params.formData);
	if (scopes.length === 0) {
		return {
			ok: false,
			action: "create-agent",
			error: "Select at least one scope.",
		};
	}

	const { agentId, token } = await params.createAgentAction({
		instanceId: params.context.instanceId,
		createdByUserId: params.context.authUser.id,
		displayName,
		displayLabel: displayLabel || undefined,
		instanceRole: requestedRole,
		grants: toInstanceGrants(params.context.instanceId, scopes),
	});

	await params.context.writeAuditLog({
		action: "agent.create",
		actor: { type: "user", id: params.context.authUser.id },
		resourceType: "agent",
		resourceId: agentId,
		request: params.context.request,
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
		baseUrl: getPublicOrigin(params.context.request),
	};
}

export async function handleServerSettingsAgentsAction(
	params: { request: Request },
	deps?: ActionDeps,
): Promise<ServerSettingsAgentsActionData> {
	const resolveViewer = deps?.resolveViewerRole ?? resolveViewerRole;

	try {
		const { authUser, viewerRole, setup } = await resolveViewer({
			request: params.request,
		});
		if (!authUser) {
			return { ok: false, error: "Sign in required." };
		}
		if (viewerRole !== "admin") {
			return { ok: false, error: "Admin access required." };
		}
		if (!setup.isSetup || !setup.instance) {
			return { ok: false, error: "Run setup before creating agents." };
		}

		const formData = await params.request.formData();
		const actionType = String(formData.get("_action") ?? "");
		const context: ActionContext = {
			authUser,
			instanceId: setup.instance.id,
			request: params.request,
			writeAuditLog: deps?.writeAuditLog ?? writeAuditLogSafely,
		};

		switch (actionType) {
			case "disable-agent":
				return handleDisableAgent({
					formData,
					context,
					disableAgentAction: deps?.disableAgent ?? disableAgent,
				});
			case "rotate-agent":
				return handleRotateAgent({
					formData,
					context,
					rotateAgentAction: deps?.rotateAgentToken ?? rotateAgentToken,
				});
			case "update-grants":
				return handleUpdateGrants({
					formData,
					context,
					setAgentGrantsAction: deps?.setAgentGrants ?? setAgentGrants,
				});
			case "revoke-session":
				return handleRevokeSession({
					formData,
					context,
					revokeSessionAction:
						deps?.revokeAgentMcpSession ?? revokeAgentMcpSession,
				});
			case "create-agent":
				return handleCreateAgent({
					formData,
					context,
					createAgentAction: deps?.createAgent ?? createAgent,
				});
			default:
				return { ok: false, error: "Unsupported action." };
		}
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
