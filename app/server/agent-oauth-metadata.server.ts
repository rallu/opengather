import { getPublicOrigin } from "./request-origin.server.ts";

export const MCP_OAUTH_SUPPORTED_SCOPES = [
	"instance.feed.read",
	"instance.feed.post",
	"instance.feed.reply",
	"instance.notifications.create",
] as const;

function jsonResponse(body: Record<string, unknown>): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: {
			"cache-control": "no-store",
			"content-type": "application/json; charset=utf-8",
		},
	});
}

export function getOauthAuthorizationServerMetadata(params: {
	request: Request;
}): Record<string, unknown> {
	const origin = getPublicOrigin(params.request);
	return {
		issuer: origin,
		authorization_endpoint: `${origin}/authorize`,
		token_endpoint: `${origin}/token`,
		response_types_supported: ["code"],
		grant_types_supported: ["authorization_code", "refresh_token"],
		token_endpoint_auth_methods_supported: ["none"],
		code_challenge_methods_supported: ["S256"],
		scopes_supported: [...MCP_OAUTH_SUPPORTED_SCOPES],
	};
}

export function createOauthAuthorizationServerMetadataResponse(params: {
	request: Request;
}): Response {
	return jsonResponse(getOauthAuthorizationServerMetadata(params));
}

export function getOauthProtectedResourceMetadata(params: {
	request: Request;
}): Record<string, unknown> {
	const origin = getPublicOrigin(params.request);
	return {
		resource: `${origin}/mcp`,
		authorization_servers: [origin],
		bearer_methods_supported: ["header"],
		scopes_supported: [...MCP_OAUTH_SUPPORTED_SCOPES],
	};
}

export function createOauthProtectedResourceMetadataResponse(params: {
	request: Request;
}): Response {
	return jsonResponse(getOauthProtectedResourceMetadata(params));
}

export function createMcpWwwAuthenticateHeader(params: {
	request: Request;
	error?: "invalid_token";
	errorDescription?: string;
}): string {
	const origin = getPublicOrigin(params.request);
	const parts = ['Bearer realm="OpenGather MCP"'];
	if (params.error) {
		parts.push(`error="${params.error}"`);
	}
	if (params.errorDescription) {
		const escaped = params.errorDescription.replace(/"/g, '\\"');
		parts.push(`error_description="${escaped}"`);
	}
	parts.push(
		`resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`,
	);
	return parts.join(", ");
}
