import assert from "node:assert/strict";
import test from "node:test";
import { handleAgentMcpHttpRequest } from "./mcp.ts";

test("MCP HTTP route returns 405 for GET when SSE is not offered", async () => {
	const response = await handleAgentMcpHttpRequest({
		request: new Request("http://localhost:5173/mcp", {
			method: "GET",
			headers: {
				accept: "text/event-stream",
			},
		}),
	});

	assert.equal(response.status, 405);
	assert.equal(response.headers.get("allow"), "GET, POST");
	assert.equal(await response.text(), "Method Not Allowed");
});

test("MCP HTTP route initializes over POST", async () => {
	const response = await handleAgentMcpHttpRequest({
		request: new Request("http://localhost:5173/mcp", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2025-03-26",
				},
			}),
		}),
	});

	assert.equal(response.status, 200);
	assert.equal(
		response.headers.get("content-type"),
		"application/json; charset=utf-8",
	);
	assert.deepEqual(await response.json(), {
		jsonrpc: "2.0",
		id: 1,
		result: {
			protocolVersion: "2025-03-26",
			capabilities: {
				tools: {},
			},
			serverInfo: {
				name: "opengather-agent",
				version: "0.1.0",
			},
		},
	});
});

test("MCP HTTP route requires bearer auth for tool calls", async () => {
	const response = await handleAgentMcpHttpRequest({
		request: new Request("http://localhost:5173/mcp", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 2,
				method: "tools/call",
				params: {
					name: "get_me",
				},
			}),
		}),
	});

	assert.equal(response.status, 401);
	assert.equal(
		response.headers.get("www-authenticate"),
		'Bearer realm="OpenGather MCP", resource_metadata="http://localhost:5173/.well-known/oauth-protected-resource/mcp"',
	);
	assert.deepEqual(await response.json(), {
		jsonrpc: "2.0",
		id: 2,
		error: {
			code: -32001,
			message: "Bearer token is required for tool calls.",
		},
	});
});

test("MCP HTTP route rejects invalid bearer auth with an OAuth challenge", async () => {
	const response = await handleAgentMcpHttpRequest({
		request: new Request("http://localhost:5173/mcp", {
			method: "POST",
			headers: {
				authorization: "Bearer ogmca_invalid",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 9,
				method: "tools/call",
				params: {
					name: "get_me",
				},
			}),
		}),
		authenticateRequest: async () => ({
			ok: false,
			code: "invalid_token",
			message: "Invalid agent token.",
		}),
	});

	assert.equal(response.status, 401);
	assert.equal(
		response.headers.get("www-authenticate"),
		'Bearer realm="OpenGather MCP", error="invalid_token", error_description="Invalid agent token.", resource_metadata="http://localhost:5173/.well-known/oauth-protected-resource/mcp"',
	);
	assert.deepEqual(await response.json(), {
		jsonrpc: "2.0",
		id: 9,
		error: {
			code: -32001,
			message: "Bearer token is invalid or expired.",
			data: {
				code: "invalid_token",
				message: "Invalid agent token.",
			},
		},
	});
});

test("MCP HTTP route passes bearer-derived config to tool handling", async () => {
	const calls: Array<{
		message: Record<string, unknown>;
		config: { baseUrl: string; token: string };
	}> = [];
	const response = await handleAgentMcpHttpRequest({
		request: new Request("http://localhost:5173/mcp", {
			method: "POST",
			headers: {
				authorization: "Bearer oga_test",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 3,
				method: "tools/call",
				params: {
					name: "create_feed_post",
					arguments: {
						bodyText: "Hello",
					},
				},
			}),
		}),
		handleRequest: async (params) => {
			calls.push(params);
			return {
				jsonrpc: "2.0",
				id: 3,
				result: {
					content: [
						{
							type: "text",
							text: "ok",
						},
					],
				},
			};
		},
		authenticateRequest: async () => ({
			ok: true,
			agent: {
				instanceId: "instance-1",
				createdByUserId: "user-1",
				id: "agent-1",
				displayName: "Codex",
				displayLabel: null,
				description: null,
				role: "assistant",
				isEnabled: true,
				lastUsedAt: null,
				deletedAt: null,
				grants: [],
			},
			subjectContext: {
				subject: { kind: "agent", agentId: "agent-1" },
				scopes: new Set(),
				instanceRole: "member",
				groupRoles: new Map(),
				isAuthenticated: true,
			},
			instanceRole: "member",
			groupRoles: new Map(),
		}),
	});

	assert.equal(response.status, 200);
	assert.deepEqual(calls, [
		{
			message: {
				jsonrpc: "2.0",
				id: 3,
				method: "tools/call",
				params: {
					name: "create_feed_post",
					arguments: {
						bodyText: "Hello",
					},
				},
			},
			config: {
				baseUrl: "http://localhost:5173",
				token: "oga_test",
			},
		},
	]);
	assert.deepEqual(await response.json(), {
		jsonrpc: "2.0",
		id: 3,
		result: {
			content: [
				{
					type: "text",
					text: "ok",
				},
			],
		},
	});
});

test("MCP HTTP route returns 202 for notifications without replies", async () => {
	const response = await handleAgentMcpHttpRequest({
		request: new Request("http://localhost:5173/mcp", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				method: "notifications/initialized",
			}),
		}),
	});

	assert.equal(response.status, 202);
	assert.equal(await response.text(), "");
});

test("MCP HTTP route rejects mismatched Origin headers", async () => {
	const response = await handleAgentMcpHttpRequest({
		request: new Request("http://localhost:5173/mcp", {
			method: "POST",
			headers: {
				origin: "https://evil.example",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 4,
				method: "initialize",
			}),
		}),
	});

	assert.equal(response.status, 403);
	assert.deepEqual(await response.json(), {
		jsonrpc: "2.0",
		id: null,
		error: {
			code: -32003,
			message: "Origin not allowed.",
		},
	});
});
