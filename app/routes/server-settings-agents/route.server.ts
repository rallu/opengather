import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { writeAuditLogSafely } from "../../server/audit-log.service.server.ts";
import {
	createAgent,
	disableAgent,
	listAgents,
	rotateAgentToken,
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
			ok: false;
			action?: "create-agent" | "disable-agent" | "rotate-agent";
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

function parseRequestedScopes(formData: FormData): string[] {
	const scopes: string[] = [];
	if (String(formData.get("scope_instance_feed_read") ?? "") === "on") {
		scopes.push("instance.feed.read");
	}
	if (String(formData.get("scope_instance_feed_post") ?? "") === "on") {
		scopes.push("instance.feed.post");
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
		rotateAgentToken?: typeof rotateAgentToken;
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
			actionType !== "rotate-agent"
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
	},
): Promise<ServerSettingsAgentsLoaderData> {
	try {
		const { authUser, setup, viewerRole } = await (
			deps?.resolveViewerRole ?? resolveViewerRole
		)({
			request: params.request,
		});
		const agents =
			setup.isSetup && setup.instance && canManageInstance({ viewerRole }).allowed
				? await (deps?.listAgents ?? listAgents)({
						instanceId: setup.instance.id,
					})
				: [];

		return {
			authUser,
			viewerRole,
			setup,
			baseUrl: getPublicOrigin(params.request),
			agents,
		};
	} catch {
		return {
			authUser: null,
			viewerRole: "guest",
			setup: { isSetup: false },
			baseUrl: getPublicOrigin(params.request),
			agents: [],
		};
	}
}
