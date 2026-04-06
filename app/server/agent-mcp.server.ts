export type AgentMcpConfig = {
	baseUrl: string;
	token: string;
	fetchFn?: typeof fetch;
};

type JsonObject = Record<string, unknown>;

type JsonRpcRequest = {
	jsonrpc: "2.0";
	id?: string | number | null;
	method: string;
	params?: JsonObject;
};

type JsonRpcResponse = {
	jsonrpc: "2.0";
	id: string | number | null;
	result?: JsonObject;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
};

type AgentToolDefinition = {
	name: string;
	description: string;
	inputSchema: JsonObject;
};

const MCP_SERVER_NAME = "opengather-agent";
const MCP_SERVER_VERSION = "0.1.0";

export const AGENT_MCP_TOOLS: AgentToolDefinition[] = [
	{
		name: "get_me",
		description:
			"Inspect the authenticated OpenGather agent identity, roles, scopes, and grants.",
		inputSchema: {
			type: "object",
			properties: {},
			additionalProperties: false,
		},
	},
	{
		name: "list_groups",
		description:
			"List the groups visible to this agent and whether the agent can post to each one.",
		inputSchema: {
			type: "object",
			properties: {},
			additionalProperties: false,
		},
	},
	{
		name: "create_feed_post",
		description: "Create a post in the instance feed.",
		inputSchema: {
			type: "object",
			properties: {
				bodyText: {
					type: "string",
					minLength: 1,
				},
			},
			required: ["bodyText"],
			additionalProperties: false,
		},
	},
	{
		name: "create_group_post",
		description: "Create a post in a specific group.",
		inputSchema: {
			type: "object",
			properties: {
				groupId: {
					type: "string",
					minLength: 1,
				},
				bodyText: {
					type: "string",
					minLength: 1,
				},
			},
			required: ["groupId", "bodyText"],
			additionalProperties: false,
		},
	},
	{
		name: "create_reply",
		description: "Reply to an existing post.",
		inputSchema: {
			type: "object",
			properties: {
				postId: {
					type: "string",
					minLength: 1,
				},
				bodyText: {
					type: "string",
					minLength: 1,
				},
			},
			required: ["postId", "bodyText"],
			additionalProperties: false,
		},
	},
	{
		name: "create_notification",
		description: "Create an agent-authored notification for a user in this instance.",
		inputSchema: {
			type: "object",
			properties: {
				userId: {
					type: "string",
					minLength: 1,
				},
				title: {
					type: "string",
					minLength: 1,
				},
				body: {
					type: "string",
					minLength: 1,
				},
				targetUrl: {
					type: "string",
				},
			},
			required: ["userId", "title", "body"],
			additionalProperties: false,
		},
	},
	{
		name: "hide_post",
		description: "Hide a post using the limited moderation endpoint.",
		inputSchema: {
			type: "object",
			properties: {
				postId: {
					type: "string",
					minLength: 1,
				},
			},
			required: ["postId"],
			additionalProperties: false,
		},
	},
];

function createJsonRpcError(params: {
	id: JsonRpcResponse["id"];
	code: number;
	message: string;
	data?: unknown;
}): JsonRpcResponse {
	return {
		jsonrpc: "2.0",
		id: params.id,
		error: {
			code: params.code,
			message: params.message,
			...(params.data !== undefined ? { data: params.data } : {}),
		},
	};
}

function requireStringArgument(
	value: unknown,
	name: string,
): string {
	const normalized = String(value ?? "").trim();
	if (!normalized) {
		throw new Error(`${name} is required.`);
	}
	return normalized;
}

async function requestAgentApi(params: {
	config: AgentMcpConfig;
	path: string;
	method?: "GET" | "POST";
	body?: JsonObject;
}): Promise<unknown> {
	const response = await (params.config.fetchFn ?? fetch)(
		`${params.config.baseUrl}${params.path}`,
		{
			method: params.method ?? "GET",
			headers: {
				authorization: `Bearer ${params.config.token}`,
				"content-type": "application/json",
			},
			body: params.body ? JSON.stringify(params.body) : undefined,
		},
	);

	const data = (await response.json()) as unknown;
	if (!response.ok) {
		throw new Error(JSON.stringify(data));
	}
	return data;
}

export async function callAgentMcpTool(params: {
	name: string;
	arguments?: JsonObject;
	config: AgentMcpConfig;
}): Promise<{
	content: Array<{ type: "text"; text: string }>;
	structuredContent: unknown;
	isError?: boolean;
}> {
	const toolArgs = params.arguments ?? {};
	let result: unknown;

	switch (params.name) {
		case "get_me":
			result = await requestAgentApi({
				config: params.config,
				path: "/api/agents/v1/me",
			});
			break;
		case "list_groups":
			result = await requestAgentApi({
				config: params.config,
				path: "/api/agents/v1/groups",
			});
			break;
		case "create_feed_post":
			result = await requestAgentApi({
				config: params.config,
				path: "/api/agents/v1/feed/posts",
				method: "POST",
				body: {
					bodyText: requireStringArgument(toolArgs.bodyText, "bodyText"),
				},
			});
			break;
		case "create_group_post":
			result = await requestAgentApi({
				config: params.config,
				path: `/api/agents/v1/groups/${requireStringArgument(
					toolArgs.groupId,
					"groupId",
				)}/posts`,
				method: "POST",
				body: {
					bodyText: requireStringArgument(toolArgs.bodyText, "bodyText"),
				},
			});
			break;
		case "create_reply":
			result = await requestAgentApi({
				config: params.config,
				path: `/api/agents/v1/posts/${requireStringArgument(
					toolArgs.postId,
					"postId",
				)}/replies`,
				method: "POST",
				body: {
					bodyText: requireStringArgument(toolArgs.bodyText, "bodyText"),
				},
			});
			break;
		case "create_notification":
			result = await requestAgentApi({
				config: params.config,
				path: "/api/agents/v1/notifications",
				method: "POST",
				body: {
					userId: requireStringArgument(toolArgs.userId, "userId"),
					title: requireStringArgument(toolArgs.title, "title"),
					body: requireStringArgument(toolArgs.body, "body"),
					...(toolArgs.targetUrl
						? {
								targetUrl: requireStringArgument(
									toolArgs.targetUrl,
									"targetUrl",
								),
							}
						: {}),
				},
			});
			break;
		case "hide_post":
			result = await requestAgentApi({
				config: params.config,
				path: `/api/agents/v1/posts/${requireStringArgument(
					toolArgs.postId,
					"postId",
				)}/hide`,
				method: "POST",
			});
			break;
		default:
			throw new Error(`Unknown tool: ${params.name}`);
	}

	return {
		content: [
			{
				type: "text",
				text: JSON.stringify(result, null, 2),
			},
		],
		structuredContent: result,
	};
}

export async function handleAgentMcpRequest(params: {
	message: JsonRpcRequest;
	config: AgentMcpConfig;
}): Promise<JsonRpcResponse | null> {
	const id = params.message.id ?? null;
	switch (params.message.method) {
		case "initialize":
			return {
				jsonrpc: "2.0",
				id,
				result: {
					protocolVersion:
						typeof params.message.params?.protocolVersion === "string"
							? params.message.params.protocolVersion
							: "2024-11-05",
					capabilities: {
						tools: {},
					},
					serverInfo: {
						name: MCP_SERVER_NAME,
						version: MCP_SERVER_VERSION,
					},
				},
			};
		case "notifications/initialized":
			return null;
		case "ping":
			return {
				jsonrpc: "2.0",
				id,
				result: {},
			};
		case "tools/list":
			return {
				jsonrpc: "2.0",
				id,
				result: {
					tools: AGENT_MCP_TOOLS,
				},
			};
		case "tools/call":
			if (!params.message.params?.name) {
				return createJsonRpcError({
					id,
					code: -32602,
					message: "Tool name is required.",
				});
			}

			try {
				const result = await callAgentMcpTool({
					name: String(params.message.params.name),
					arguments:
						typeof params.message.params.arguments === "object" &&
						params.message.params.arguments
							? (params.message.params.arguments as JsonObject)
							: {},
					config: params.config,
				});

				return {
					jsonrpc: "2.0",
					id,
					result,
				};
			} catch (error) {
				return {
					jsonrpc: "2.0",
					id,
					result: {
						content: [
							{
								type: "text",
								text: error instanceof Error ? error.message : "unknown error",
							},
						],
						isError: true,
					},
				};
			}
		default:
			return createJsonRpcError({
				id,
				code: -32601,
				message: `Method not found: ${params.message.method}`,
			});
	}
}

export function encodeMcpMessage(message: JsonRpcResponse): Buffer {
	const body = Buffer.from(JSON.stringify(message), "utf8");
	const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8");
	return Buffer.concat([header, body]);
}

export function parseNextMcpMessage(buffer: Buffer): {
	message?: JsonRpcRequest;
	rest: Buffer;
} {
	const headerEnd = buffer.indexOf("\r\n\r\n");
	if (headerEnd === -1) {
		return { rest: buffer };
	}

	const headerText = buffer.subarray(0, headerEnd).toString("utf8");
	const contentLengthMatch = /^Content-Length:\s*(\d+)$/im.exec(headerText);
	if (!contentLengthMatch) {
		throw new Error("Missing Content-Length header.");
	}

	const contentLength = Number.parseInt(contentLengthMatch[1] ?? "", 10);
	const bodyStart = headerEnd + 4;
	const bodyEnd = bodyStart + contentLength;
	if (buffer.length < bodyEnd) {
		return { rest: buffer };
	}

	const body = buffer.subarray(bodyStart, bodyEnd).toString("utf8");
	return {
		message: JSON.parse(body) as JsonRpcRequest,
		rest: buffer.subarray(bodyEnd),
	};
}

export function resolveAgentMcpConfig(params: {
	env: NodeJS.ProcessEnv;
	argv: string[];
}): AgentMcpConfig {
	let baseUrl = params.env.OG_BASE_URL?.trim() ?? "";
	let token = params.env.OG_AGENT_TOKEN?.trim() ?? "";

	for (let index = 0; index < params.argv.length; index += 1) {
		const flag = params.argv[index];
		switch (flag) {
			case "--base-url":
				baseUrl = String(params.argv[index + 1] ?? "").trim();
				index += 1;
				break;
			case "--token":
				token = String(params.argv[index + 1] ?? "").trim();
				index += 1;
				break;
			case "--help":
			case "-h":
				return {
					baseUrl: "",
					token: "",
				};
			default:
				throw new Error(`Unsupported flag: ${flag}`);
		}
	}

	return {
		baseUrl: baseUrl.replace(/\/+$/, ""),
		token,
	};
}
