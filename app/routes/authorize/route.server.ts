import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import {
	type AgentSummary,
	createAgent,
	listAgents,
} from "../../server/agent.service.server.ts";
import { createMcpAuthorizationCode } from "../../server/agent-oauth.server.ts";
import { writeAuditLogSafely } from "../../server/audit-log.service.server.ts";
import {
	canManageInstance,
	getViewerContext as getPermissionsViewerContext,
} from "../../server/permissions.server.ts";

type ViewerContext = Awaited<ReturnType<typeof getPermissionsViewerContext>>;

type OAuthRequestData = {
	clientId: string | null;
	redirectUri: string;
	state: string | null;
	codeChallenge: string;
	codeChallengeMethod: "S256";
	scope: string[];
};

export type AuthorizeLoaderData = {
	authUser: ViewerContext["authUser"];
	viewerRole: ViewerContext["viewerRole"];
	setup: ViewerContext["setup"];
	oauth: OAuthRequestData;
	agents: AgentSummary[];
};

export type AuthorizeActionData =
	| {
			ok: false;
			error: string;
	  }
	| undefined;

function parseScopeList(scopeValue: string | null): string[] {
	return (scopeValue ?? "")
		.split(/\s+/)
		.map((value) => value.trim())
		.filter(Boolean);
}

function isAllowedRedirectUri(value: string): boolean {
	try {
		const url = new URL(value);
		if (url.protocol === "https:") {
			return true;
		}
		if (url.protocol !== "http:") {
			return false;
		}
		return url.hostname === "localhost" || url.hostname === "127.0.0.1";
	} catch {
		return false;
	}
}

function parseAuthorizeRequest(request: Request): OAuthRequestData {
	const url = new URL(request.url);
	const responseType = url.searchParams.get("response_type")?.trim() ?? "";
	const redirectUri = url.searchParams.get("redirect_uri")?.trim() ?? "";
	const codeChallenge = url.searchParams.get("code_challenge")?.trim() ?? "";
	const codeChallengeMethod =
		url.searchParams.get("code_challenge_method")?.trim() ?? "";

	if (responseType !== "code") {
		throw new Response("response_type=code is required.", { status: 400 });
	}
	if (!isAllowedRedirectUri(redirectUri)) {
		throw new Response(
			"redirect_uri must be an https URL or a localhost http URL.",
			{ status: 400 },
		);
	}
	if (!codeChallenge) {
		throw new Response("code_challenge is required.", { status: 400 });
	}
	if (codeChallengeMethod !== "S256") {
		throw new Response("code_challenge_method must be S256.", {
			status: 400,
		});
	}

	return {
		clientId: url.searchParams.get("client_id")?.trim() || null,
		redirectUri,
		state: url.searchParams.get("state")?.trim() || null,
		codeChallenge,
		codeChallengeMethod: "S256",
		scope: parseScopeList(url.searchParams.get("scope")),
	};
}

function getEnabledAgents(agents: AgentSummary[]): AgentSummary[] {
	return agents.filter((agent) => agent.isEnabled && !agent.deletedAt);
}

function getAgentScopeSet(agent: AgentSummary): Set<string> {
	return new Set(agent.grants.map((grant) => grant.scope));
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

function buildAuthorizationRedirect(params: {
	redirectUri: string;
	code?: string;
	state?: string | null;
	error?: string;
}): string {
	const url = new URL(params.redirectUri);
	if (params.code) {
		url.searchParams.set("code", params.code);
	}
	if (params.error) {
		url.searchParams.set("error", params.error);
	}
	if (params.state) {
		url.searchParams.set("state", params.state);
	}
	return url.toString();
}

async function resolveViewer(params: { request: Request }) {
	return getPermissionsViewerContext({ request: params.request });
}

export async function loader(
	params: LoaderFunctionArgs,
	deps?: {
		resolveViewer?: typeof resolveViewer;
		listAgents?: typeof listAgents;
	},
): Promise<AuthorizeLoaderData | Response> {
	const oauth = parseAuthorizeRequest(params.request);
	const viewer = await (deps?.resolveViewer ?? resolveViewer)({
		request: params.request,
	});

	if (!viewer.authUser) {
		return redirect(
			`/login?${new URLSearchParams({ next: params.request.url }).toString()}`,
		);
	}

	if (!canManageInstance({ viewerRole: viewer.viewerRole }).allowed) {
		return new Response("Admin access required.", { status: 403 });
	}

	if (!viewer.setup.isSetup || !viewer.setup.instance) {
		return new Response("Run setup before authorizing MCP clients.", {
			status: 409,
		});
	}

	return {
		authUser: viewer.authUser,
		viewerRole: viewer.viewerRole,
		setup: viewer.setup,
		oauth,
		agents: getEnabledAgents(await (deps?.listAgents ?? listAgents)()),
	};
}

export async function action(
	params: ActionFunctionArgs,
	deps?: {
		resolveViewer?: typeof resolveViewer;
		listAgents?: typeof listAgents;
		createAgent?: typeof createAgent;
		createAuthorizationCode?: typeof createMcpAuthorizationCode;
		writeAuditLog?: typeof writeAuditLogSafely;
	},
): Promise<Response | AuthorizeActionData> {
	const oauth = parseAuthorizeRequest(params.request);
	const viewer = await (deps?.resolveViewer ?? resolveViewer)({
		request: params.request,
	});
	if (!viewer.authUser) {
		return redirect(
			`/login?${new URLSearchParams({ next: params.request.url }).toString()}`,
		);
	}
	if (!canManageInstance({ viewerRole: viewer.viewerRole }).allowed) {
		return new Response("Admin access required.", { status: 403 });
	}
	if (!viewer.setup.isSetup || !viewer.setup.instance) {
		return new Response("Run setup before authorizing MCP clients.", {
			status: 409,
		});
	}
	const instanceId = viewer.setup.instance.id;

	const formData = await params.request.formData();
	const decision = String(formData.get("decision") ?? "approve");
	if (decision === "deny") {
		return redirect(
			buildAuthorizationRedirect({
				redirectUri: oauth.redirectUri,
				state: oauth.state,
				error: "access_denied",
			}),
		);
	}

	const selectedAgentId = String(formData.get("agentId") ?? "").trim();
	if (!selectedAgentId) {
		return { ok: false, error: "Select an agent or create a new one." };
	}

	let agentId = selectedAgentId;
	if (selectedAgentId === "__new__") {
		const displayName = String(formData.get("displayName") ?? "").trim();
		const displayLabel = String(formData.get("displayLabel") ?? "").trim();
		if (!displayName) {
			return { ok: false, error: "Display name is required for a new agent." };
		}

		const scopes = parseRequestedScopes(formData);
		if (scopes.length === 0) {
			return { ok: false, error: "Select at least one scope for a new agent." };
		}

		const created = await (deps?.createAgent ?? createAgent)({
			instanceId,
			createdByUserId: viewer.authUser.id,
			displayName,
			displayLabel,
			instanceRole: "member",
			grants: scopes.map((scope) => ({
				resourceType: "instance",
				resourceId: instanceId,
				scope,
			})),
		});
		agentId = created.agentId;
		await (deps?.writeAuditLog ?? writeAuditLogSafely)({
			action: "agent.create",
			actor: { type: "user", id: viewer.authUser.id },
			resourceType: "agent",
			resourceId: agentId,
			request: params.request,
			payload: {
				outcome: "success",
				source: "mcp_authorize",
			},
		});
	} else {
		const agents = getEnabledAgents(await (deps?.listAgents ?? listAgents)());
		const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);
		if (!selectedAgent) {
			return { ok: false, error: "Selected agent was not found." };
		}
		const grantedScopes = getAgentScopeSet(selectedAgent);
		const missingScopes = oauth.scope.filter(
			(scope) => !grantedScopes.has(scope),
		);
		if (missingScopes.length > 0) {
			return {
				ok: false,
				error: `Selected agent is missing requested scopes: ${missingScopes.join(", ")}`,
			};
		}
	}

	const code = await (
		deps?.createAuthorizationCode ?? createMcpAuthorizationCode
	)({
		agentId,
		userId: viewer.authUser.id,
		redirectUri: oauth.redirectUri,
		codeChallenge: oauth.codeChallenge,
		codeChallengeMethod: oauth.codeChallengeMethod,
		clientId: oauth.clientId ?? undefined,
	});
	await (deps?.writeAuditLog ?? writeAuditLogSafely)({
		action: "agent.mcp.authorize",
		actor: { type: "user", id: viewer.authUser.id },
		resourceType: "agent",
		resourceId: agentId,
		request: params.request,
		payload: {
			outcome: "success",
			clientId: oauth.clientId,
			scope: oauth.scope,
		},
	});

	return redirect(
		buildAuthorizationRedirect({
			redirectUri: oauth.redirectUri,
			code: code.code,
			state: oauth.state,
		}),
	);
}
