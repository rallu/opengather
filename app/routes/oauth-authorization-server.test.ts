import assert from "node:assert/strict";
import test from "node:test";
import { loader as authorizationLoader } from "./oauth-authorization-server.ts";
import { loader as protectedResourceLoader } from "./oauth-protected-resource-mcp.ts";

test("OAuth authorization server metadata exposes root authorize and token endpoints", async () => {
	const response = await authorizationLoader({
		request: new Request("http://localhost:5173/.well-known/oauth-authorization-server"),
		params: {},
		context: {},
		unstable_pattern: "",
	} as never);

	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), {
		issuer: "http://localhost:5173",
		authorization_endpoint: "http://localhost:5173/authorize",
		token_endpoint: "http://localhost:5173/token",
		response_types_supported: ["code"],
		grant_types_supported: ["authorization_code", "refresh_token"],
		token_endpoint_auth_methods_supported: ["none"],
		code_challenge_methods_supported: ["S256"],
		scopes_supported: [
			"instance.feed.read",
			"instance.feed.post",
			"instance.feed.reply",
			"instance.notifications.create",
		],
	});
});

test("OAuth protected resource metadata points clients back to the MCP resource", async () => {
	const response = await protectedResourceLoader({
		request: new Request(
			"http://localhost:5173/.well-known/oauth-protected-resource/mcp",
		),
		params: {},
		context: {},
		unstable_pattern: "",
	} as never);

	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), {
		resource: "http://localhost:5173/mcp",
		authorization_servers: ["http://localhost:5173"],
		bearer_methods_supported: ["header"],
		scopes_supported: [
			"instance.feed.read",
			"instance.feed.post",
			"instance.feed.reply",
			"instance.notifications.create",
		],
	});
});
