import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
	type AgentMcpSessionSummary,
	type AgentSummary,
	listAgentMcpSessions,
	listAgents,
} from "../../server/agent.service.server.ts";
import { getPublicOrigin } from "../../server/request-origin.server.ts";
import { handleServerSettingsAgentsAction } from "./route.server.actions.ts";
import {
	canManageInstanceFromViewer,
	isMissingAgentMcpStorageError,
	resolveViewerRole,
	type ServerSettingsAgentsActionData,
	type ServerSettingsAgentsLoaderData,
} from "./route.server.shared.ts";

export type {
	ServerSettingsAgentsActionData,
	ServerSettingsAgentsLoaderData,
} from "./route.server.shared.ts";

export async function action(
	params: ActionFunctionArgs,
	deps?: {
		resolveViewerRole?: typeof resolveViewerRole;
		createAgent?: typeof import("../../server/agent.service.server.ts").createAgent;
		disableAgent?: typeof import("../../server/agent.service.server.ts").disableAgent;
		revokeAgentMcpSession?: typeof import("../../server/agent.service.server.ts").revokeAgentMcpSession;
		rotateAgentToken?: typeof import("../../server/agent.service.server.ts").rotateAgentToken;
		setAgentGrants?: typeof import("../../server/agent.service.server.ts").setAgentGrants;
		writeAuditLog?: typeof import("../../server/audit-log.service.server.ts").writeAuditLogSafely;
	},
): Promise<ServerSettingsAgentsActionData> {
	return handleServerSettingsAgentsAction(params, deps);
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
			canManageInstanceFromViewer({ viewerRole })
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
