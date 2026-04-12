import assert from "node:assert/strict";
import test from "node:test";
import { handleMcpTokenRequest } from "./mcp-token.server.ts";

test("MCP token endpoint exchanges authorization codes", async () => {
	const response = await handleMcpTokenRequest({
		request: new Request("http://localhost:5173/mcp/token", {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code: "code-1",
				redirect_uri: "https://example.test/callback",
				code_verifier: "verifier-1",
				client_id: "codex",
			}),
		}),
		exchangeCode: async (params) => {
			assert.equal(params.code, "code-1");
			assert.equal(params.redirectUri, "https://example.test/callback");
			assert.equal(params.codeVerifier, "verifier-1");
			assert.equal(params.clientId, "codex");
			return {
				sessionId: "session-1",
				agentId: "agent-1",
				accessToken: "ogmca_token",
				accessTokenExpiresAt: new Date("2026-04-06T12:15:00.000Z"),
				refreshToken: "ogmcr_token",
				refreshTokenExpiresAt: new Date("2026-05-06T12:00:00.000Z"),
			};
		},
	});

	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), {
		token_type: "Bearer",
		access_token: "ogmca_token",
		expires_in: 900,
		refresh_token: "ogmcr_token",
		scope: "",
		agent_id: "agent-1",
		session_id: "session-1",
	});
});

test("MCP token endpoint rotates refresh tokens", async () => {
	const response = await handleMcpTokenRequest({
		request: new Request("http://localhost:5173/mcp/token", {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: "ogmcr_token",
			}),
		}),
		refreshTokens: async (params) => {
			assert.equal(params.refreshToken, "ogmcr_token");
			return {
				sessionId: "session-1",
				agentId: "agent-1",
				accessToken: "ogmca_token_2",
				accessTokenExpiresAt: new Date("2026-04-06T12:30:00.000Z"),
				refreshToken: "ogmcr_token_2",
				refreshTokenExpiresAt: new Date("2026-05-06T12:00:00.000Z"),
			};
		},
	});

	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), {
		token_type: "Bearer",
		access_token: "ogmca_token_2",
		expires_in: 900,
		refresh_token: "ogmcr_token_2",
		scope: "",
		agent_id: "agent-1",
		session_id: "session-1",
	});
});

test("MCP token endpoint rejects invalid request bodies", async () => {
	const response = await handleMcpTokenRequest({
		request: new Request("http://localhost:5173/mcp/token", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({ grant_type: "authorization_code" }),
		}),
	});

	assert.equal(response.status, 400);
	assert.deepEqual(await response.json(), {
		error: "invalid_request",
		error_description:
			"Token endpoint requires application/x-www-form-urlencoded input.",
	});
});

test("MCP token endpoint rejects invalid grants", async () => {
	const response = await handleMcpTokenRequest({
		request: new Request("http://localhost:5173/mcp/token", {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code: "bad",
				redirect_uri: "https://example.test/callback",
				code_verifier: "wrong",
			}),
		}),
		exchangeCode: async () => {
			throw new Error("Invalid authorization code.");
		},
	});

	assert.equal(response.status, 400);
	assert.deepEqual(await response.json(), {
		error: "invalid_grant",
		error_description: "Invalid authorization code.",
	});
});
