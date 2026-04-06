import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticateAgentRequest } from "../server/agent-auth.server.ts";
import {
	type AgentMcpConfig,
	handleAgentMcpRequest,
} from "../server/agent-mcp.server.ts";
import { createMcpWwwAuthenticateHeader } from "../server/agent-oauth-metadata.server.ts";

type JsonRpcRequestShape = {
	jsonrpc: "2.0";
	id?: string | number | null;
	method: string;
	params?: Record<string, unknown>;
};

function createJsonRpcResponse(
	body: Record<string, unknown>,
	status: number,
	headers?: Record<string, string>,
): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"cache-control": "no-store",
			"content-type": "application/json; charset=utf-8",
			...(headers ?? {}),
		},
	});
}

function createJsonRpcErrorResponse(params: {
	id: string | number | null;
	status: number;
	code: number;
	message: string;
	data?: unknown;
	headers?: Record<string, string>;
}): Response {
	return createJsonRpcResponse(
		{
			jsonrpc: "2.0",
			id: params.id,
			error: {
				code: params.code,
				message: params.message,
				...(params.data !== undefined ? { data: params.data } : {}),
			},
		},
		params.status,
		params.headers,
	);
}

function parseBearerToken(request: Request): string | null {
	const authorization = request.headers.get("authorization")?.trim();
	if (!authorization) {
		return null;
	}

	const match = /^Bearer\s+(.+)$/i.exec(authorization);
	return match?.[1]?.trim() || null;
}

function isValidOrigin(request: Request): boolean {
	const origin = request.headers.get("origin");
	if (!origin) {
		return true;
	}

	return origin === new URL(request.url).origin;
}

function toJsonRpcRequest(value: unknown): JsonRpcRequestShape | null {
	if (!value || typeof value !== "object") {
		return null;
	}

	const candidate = value as Record<string, unknown>;
	if (candidate.jsonrpc !== "2.0" || typeof candidate.method !== "string") {
		return null;
	}

	const id = candidate.id;
	if (
		id !== undefined &&
		id !== null &&
		typeof id !== "string" &&
		typeof id !== "number"
	) {
		return null;
	}

	if (
		candidate.params !== undefined &&
		(!candidate.params || typeof candidate.params !== "object")
	) {
		return null;
	}

	return candidate as JsonRpcRequestShape;
}

export async function handleAgentMcpHttpRequest(params: {
	request: Request;
	handleRequest?: (params: {
		message: JsonRpcRequestShape;
		config: AgentMcpConfig;
	}) => Promise<Record<string, unknown> | null>;
	authenticateRequest?: typeof authenticateAgentRequest;
}): Promise<Response> {
	if (params.request.method === "GET") {
		return new Response("Method Not Allowed", {
			status: 405,
			headers: {
				allow: "GET, POST",
				"cache-control": "no-store",
				"content-type": "text/plain; charset=utf-8",
			},
		});
	}

	if (!isValidOrigin(params.request)) {
		return createJsonRpcErrorResponse({
			id: null,
			status: 403,
			code: -32003,
			message: "Origin not allowed.",
		});
	}

	let body: unknown;
	try {
		body = await params.request.json();
	} catch {
		return createJsonRpcErrorResponse({
			id: null,
			status: 400,
			code: -32700,
			message: "Parse error",
		});
	}

	const message = toJsonRpcRequest(body);
	if (!message) {
		return createJsonRpcErrorResponse({
			id: null,
			status: 400,
			code: -32600,
			message: "Invalid Request",
		});
	}

	if (message.method === "tools/call" && !parseBearerToken(params.request)) {
		return createJsonRpcErrorResponse({
			id: message.id ?? null,
			status: 401,
			code: -32001,
			message: "Bearer token is required for tool calls.",
			headers: {
				"www-authenticate": createMcpWwwAuthenticateHeader({
					request: params.request,
				}),
			},
		});
	}

	if (message.method === "tools/call") {
		const authResult = await (
			params.authenticateRequest ?? authenticateAgentRequest
		)({
			request: params.request,
		});
		if (!authResult.ok) {
			return createJsonRpcErrorResponse({
				id: message.id ?? null,
				status: 401,
				code: -32001,
				message: "Bearer token is invalid or expired.",
				data: {
					code: authResult.code,
					message: authResult.message,
				},
				headers: {
					"www-authenticate": createMcpWwwAuthenticateHeader({
						request: params.request,
						error: "invalid_token",
						errorDescription: authResult.message,
					}),
				},
			});
		}
	}

	try {
		const response = await (params.handleRequest ?? handleAgentMcpRequest)({
			message,
			config: {
				baseUrl: new URL(params.request.url).origin,
				token: parseBearerToken(params.request) ?? "",
			},
		});

		if (!response) {
			return new Response(null, {
				status: 202,
				headers: {
					allow: "GET, POST",
					"cache-control": "no-store",
				},
			});
		}

		return createJsonRpcResponse(response, 200);
	} catch (error) {
		return createJsonRpcErrorResponse({
			id: message.id ?? null,
			status: 500,
			code: -32603,
			message: error instanceof Error ? error.message : "Internal server error",
		});
	}
}

export async function loader({
	request,
}: LoaderFunctionArgs): Promise<Response> {
	return handleAgentMcpHttpRequest({ request });
}

export async function action({
	request,
}: ActionFunctionArgs): Promise<Response> {
	return handleAgentMcpHttpRequest({ request });
}
