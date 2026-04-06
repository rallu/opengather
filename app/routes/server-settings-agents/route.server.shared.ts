import {
	canManageInstance,
	getViewerContext as getPermissionsViewerContext,
} from "../../server/permissions.server.ts";

type ViewerContext = Awaited<ReturnType<typeof getPermissionsViewerContext>>;

export type ServerSettingsAgentsLoaderData = {
	authUser: ViewerContext["authUser"];
	viewerRole: ViewerContext["viewerRole"];
	setup: ViewerContext["setup"];
	baseUrl: string;
	agents: import("../../server/agent.service.server.ts").AgentSummary[];
	sessions: import("../../server/agent.service.server.ts").AgentMcpSessionSummary[];
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

export async function resolveViewerRole(params: { request: Request }): Promise<{
	authUser: ViewerContext["authUser"];
	setup: ViewerContext["setup"];
	viewerRole: ViewerContext["viewerRole"];
}> {
	return getPermissionsViewerContext({ request: params.request });
}

export function canManageInstanceFromViewer(params: {
	viewerRole: ViewerContext["viewerRole"];
}): boolean {
	return canManageInstance({ viewerRole: params.viewerRole }).allowed;
}

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

export function parseRequestedScopes(formData: FormData): string[] {
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
