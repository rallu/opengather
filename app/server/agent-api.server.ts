import { randomUUID } from "node:crypto";
import type { AgentAuthResult } from "./agent-auth.server.ts";
import {
	buildRateLimitHeaders,
	checkRateLimit,
	getRequestIp,
	type RateLimitResult,
} from "./rate-limit.server.ts";

export type AgentApiErrorBody = {
	ok: false;
	meta: {
		requestId: string;
	};
	error: {
		code: string;
		message: string;
		details?: Record<string, unknown>;
	};
};

export type AgentApiSuccessBody<T> = {
	ok: true;
	meta: {
		requestId: string;
	};
	data: T;
};

export function resolveAgentRequestId(params: {
	request: Request;
	generateId?: () => string;
}): string {
	const requestId = params.request.headers.get("x-request-id")?.trim();
	if (requestId) {
		return requestId;
	}

	return (params.generateId ?? randomUUID)();
}

function parsePositiveInteger(
	value: string | undefined,
	fallback: number,
): number {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const DEFAULT_AGENT_API_READ_MAX_REQUESTS =
	process.env.NODE_ENV === "production" ? 120 : 1_000;
const DEFAULT_AGENT_API_WRITE_MAX_REQUESTS =
	process.env.NODE_ENV === "production" ? 30 : 300;
const AGENT_API_RATE_LIMIT_WINDOW_MS = parsePositiveInteger(
	process.env.AGENT_API_RATE_LIMIT_WINDOW_MS,
	60_000,
);
const AGENT_API_READ_MAX_REQUESTS = parsePositiveInteger(
	process.env.AGENT_API_READ_MAX_REQUESTS,
	DEFAULT_AGENT_API_READ_MAX_REQUESTS,
);
const AGENT_API_WRITE_MAX_REQUESTS = parsePositiveInteger(
	process.env.AGENT_API_WRITE_MAX_REQUESTS,
	DEFAULT_AGENT_API_WRITE_MAX_REQUESTS,
);

export function mapAgentAuthFailureStatus(
	code: Extract<AgentAuthResult, { ok: false }>["code"],
): number {
	return code === "disabled_agent" ? 403 : 401;
}

export function agentJsonSuccess<T>(
	data: T,
	params: {
		requestId: string;
		status?: number;
	},
): Response {
	return Response.json(
		{
			ok: true,
			meta: {
				requestId: params.requestId,
			},
			data,
		} satisfies AgentApiSuccessBody<T>,
		{
			status: params.status,
			headers: {
				"x-request-id": params.requestId,
			},
		},
	);
}

export function agentJsonError(params: {
	requestId: string;
	status: number;
	code: string;
	message: string;
	details?: Record<string, unknown>;
	headers?: Record<string, string>;
}): Response {
	return Response.json(
		{
			ok: false,
			meta: {
				requestId: params.requestId,
			},
			error: {
				code: params.code,
				message: params.message,
				...(params.details ? { details: params.details } : {}),
			},
		} satisfies AgentApiErrorBody,
		{
			status: params.status,
			headers: {
				"x-request-id": params.requestId,
				...(params.headers ?? {}),
			},
		},
	);
}

export function agentAuthErrorResponse(
	failure: Extract<AgentAuthResult, { ok: false }>,
	requestId: string,
): Response {
	return agentJsonError({
		requestId,
		status: mapAgentAuthFailureStatus(failure.code),
		code: failure.code,
		message: failure.message,
	});
}

export async function readAgentJsonBody<T>(params: {
	request: Request;
	requestId: string;
}): Promise<
	| {
			ok: true;
			value: T;
	  }
	| {
			ok: false;
			response: Response;
	  }
> {
	try {
		return {
			ok: true,
			value: (await params.request.json()) as T,
		};
	} catch {
		return {
			ok: false,
			response: agentJsonError({
				requestId: params.requestId,
				status: 400,
				code: "validation_error",
				message: "Request body must be valid JSON.",
			}),
		};
	}
}

export function checkAgentRouteRateLimit(params: {
	request: Request;
	agentId?: string;
	routeType: "read" | "write";
	limit?: number;
	windowMs?: number;
	nowMs?: number;
}): RateLimitResult {
	return checkRateLimit({
		bucket: `agent-api:${params.routeType}`,
		key: params.agentId
			? `agent:${params.agentId}`
			: `ip:${getRequestIp(params.request)}`,
		limit:
			params.limit ??
			(params.routeType === "write"
				? AGENT_API_WRITE_MAX_REQUESTS
				: AGENT_API_READ_MAX_REQUESTS),
		windowMs: params.windowMs ?? AGENT_API_RATE_LIMIT_WINDOW_MS,
		nowMs: params.nowMs,
	});
}

export function agentRateLimitedResponse(params: {
	requestId: string;
	result: RateLimitResult;
}): Response {
	return agentJsonError({
		requestId: params.requestId,
		status: 429,
		code: "rate_limited",
		message: "Too many agent API requests.",
		details: {
			retryAfterSeconds: params.result.retryAfterSeconds,
		},
		headers: buildRateLimitHeaders({
			result: params.result,
		}),
	});
}
