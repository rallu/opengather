import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
	exchangeMcpAuthorizationCode,
	MCP_ACCESS_TOKEN_TTL_MS,
	refreshMcpSessionTokens,
} from "../server/agent-oauth.server.ts";

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"cache-control": "no-store",
			"content-type": "application/json; charset=utf-8",
		},
	});
}

function oauthError(params: {
	status: number;
	error: string;
	errorDescription: string;
}): Response {
	return jsonResponse(
		{
			error: params.error,
			error_description: params.errorDescription,
		},
		params.status,
	);
}

async function readFormBody(request: Request): Promise<URLSearchParams | null> {
	const contentType = request.headers.get("content-type") ?? "";
	if (!contentType.includes("application/x-www-form-urlencoded")) {
		return null;
	}

	const body = await request.text();
	return new URLSearchParams(body);
}

export async function handleMcpTokenRequest(params: {
	request: Request;
	exchangeCode?: typeof exchangeMcpAuthorizationCode;
	refreshTokens?: typeof refreshMcpSessionTokens;
}): Promise<Response> {
	if (params.request.method !== "POST") {
		return new Response("Method Not Allowed", {
			status: 405,
			headers: {
				allow: "POST",
				"cache-control": "no-store",
				"content-type": "text/plain; charset=utf-8",
			},
		});
	}

	const form = await readFormBody(params.request);
	if (!form) {
		return oauthError({
			status: 400,
			error: "invalid_request",
			errorDescription:
				"Token endpoint requires application/x-www-form-urlencoded input.",
		});
	}

	const grantType = String(form.get("grant_type") ?? "").trim();
	try {
		if (grantType === "authorization_code") {
			const bundle = await (
				params.exchangeCode ?? exchangeMcpAuthorizationCode
			)({
				code: String(form.get("code") ?? ""),
				redirectUri: String(form.get("redirect_uri") ?? ""),
				codeVerifier: String(form.get("code_verifier") ?? ""),
				clientId: String(form.get("client_id") ?? "").trim() || undefined,
			});
			return jsonResponse({
				token_type: "Bearer",
				access_token: bundle.accessToken,
				expires_in: Math.floor(MCP_ACCESS_TOKEN_TTL_MS / 1000),
				refresh_token: bundle.refreshToken,
				scope: "",
				agent_id: bundle.agentId,
				session_id: bundle.sessionId,
			});
		}

		if (grantType === "refresh_token") {
			const bundle = await (params.refreshTokens ?? refreshMcpSessionTokens)({
				refreshToken: String(form.get("refresh_token") ?? ""),
			});
			return jsonResponse({
				token_type: "Bearer",
				access_token: bundle.accessToken,
				expires_in: Math.floor(MCP_ACCESS_TOKEN_TTL_MS / 1000),
				refresh_token: bundle.refreshToken,
				scope: "",
				agent_id: bundle.agentId,
				session_id: bundle.sessionId,
			});
		}

		return oauthError({
			status: 400,
			error: "unsupported_grant_type",
			errorDescription: "Unsupported grant_type.",
		});
	} catch (error) {
		return oauthError({
			status: 400,
			error: "invalid_grant",
			errorDescription:
				error instanceof Error ? error.message : "Token exchange failed.",
		});
	}
}

export async function loader({
	request,
}: LoaderFunctionArgs): Promise<Response> {
	return handleMcpTokenRequest({ request });
}

export async function action({
	request,
}: ActionFunctionArgs): Promise<Response> {
	return handleMcpTokenRequest({ request });
}
