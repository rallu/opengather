import assert from "node:assert/strict";
import test from "node:test";
import {
	AGENT_MCP_TOOLS,
	callAgentMcpTool,
	encodeMcpMessage,
	handleAgentMcpRequest,
	parseNextMcpMessage,
	resolveAgentMcpConfig,
} from "./agent-mcp.server.ts";

test("resolveAgentMcpConfig prefers explicit flags and trims the base URL", () => {
	const config = resolveAgentMcpConfig({
		env: {
			OG_BASE_URL: "http://localhost:5173/",
			OG_AGENT_TOKEN: "oga_env",
		},
		argv: ["--base-url", "http://example.test/", "--token", "oga_flag"],
	});

	assert.deepEqual(config, {
		baseUrl: "http://example.test",
		token: "oga_flag",
	});
});

test("parseNextMcpMessage decodes a framed JSON-RPC request", () => {
	const framed = Buffer.concat([
		Buffer.from("Content-Length: 58\r\n\r\n", "utf8"),
		Buffer.from(
			JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "ping",
			}),
			"utf8",
		),
	]);

	const parsed = parseNextMcpMessage(framed);
	assert.deepEqual(parsed.message, {
		jsonrpc: "2.0",
		id: 1,
		method: "ping",
	});
	assert.equal(parsed.rest.length, 0);
});

test("encodeMcpMessage writes Content-Length framing", () => {
	const framed = encodeMcpMessage({
		jsonrpc: "2.0",
		id: 1,
		result: { ok: true },
	});

	assert.match(framed.toString("utf8"), /^Content-Length: \d+\r\n\r\n/);
	assert.match(framed.toString("utf8"), /"ok":true/);
});

test("handleAgentMcpRequest initializes and lists tools", async () => {
	const init = await handleAgentMcpRequest({
		message: {
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2024-11-05",
			},
		},
		config: {
			baseUrl: "http://localhost:5173",
			token: "oga_test",
		},
	});
	assert.equal(init?.result?.serverInfo?.name, "opengather-agent");

	const tools = await handleAgentMcpRequest({
		message: {
			jsonrpc: "2.0",
			id: 2,
			method: "tools/list",
		},
		config: {
			baseUrl: "http://localhost:5173",
			token: "oga_test",
		},
	});
	assert.equal(
		Array.isArray(tools?.result?.tools),
		true,
	);
	assert.equal((tools?.result?.tools as unknown[]).length, AGENT_MCP_TOOLS.length);
});

test("callAgentMcpTool proxies a feed post request", async () => {
	const requests: Array<{
		url: string;
		method: string;
		body?: string;
		headers: Record<string, string>;
	}> = [];
	const result = await callAgentMcpTool({
		name: "create_feed_post",
		arguments: {
			bodyText: "Hello from MCP",
		},
		config: {
			baseUrl: "http://localhost:5173",
			token: "oga_test",
			fetchFn: (async (input, init) => {
				requests.push({
					url: String(input),
					method: String(init?.method ?? "GET"),
					body: init?.body ? String(init.body) : undefined,
					headers: init?.headers as Record<string, string>,
				});
				return new Response(
					JSON.stringify({
						ok: true,
						data: {
							post: {
								id: "post-1",
							},
						},
					}),
					{
						status: 201,
						headers: {
							"content-type": "application/json",
						},
					},
				);
			}) as typeof fetch,
		},
	});

	assert.equal(requests.length, 1);
	assert.deepEqual(requests[0], {
		url: "http://localhost:5173/api/agents/v1/feed/posts",
		method: "POST",
		body: JSON.stringify({
			bodyText: "Hello from MCP",
		}),
		headers: {
			authorization: "Bearer oga_test",
			"content-type": "application/json",
		},
	});
	assert.match(result.content[0]?.text ?? "", /"post-1"/);
});

test("handleAgentMcpRequest returns an MCP tool error payload for bad tool calls", async () => {
	const response = await handleAgentMcpRequest({
		message: {
			jsonrpc: "2.0",
			id: 3,
			method: "tools/call",
			params: {
				name: "create_group_post",
				arguments: {
					bodyText: "missing group id",
				},
			},
		},
		config: {
			baseUrl: "http://localhost:5173",
			token: "oga_test",
		},
	});

	assert.deepEqual(response, {
		jsonrpc: "2.0",
		id: 3,
		result: {
			content: [
				{
					type: "text",
					text: "groupId is required.",
				},
			],
			isError: true,
		},
	});
});
