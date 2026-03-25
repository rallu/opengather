import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getBetterAuth, getBetterAuthForHubOAuth } from "~/server/auth.server";
import { captureMonitoredError } from "~/server/error-monitoring.server";
import {
	buildRequestContext,
	getRequestId,
	logError,
	logInfo,
	logWarn,
} from "~/server/logger.server";
import { recordAuthFlowMetric } from "~/server/metrics.server";
import {
	buildRateLimitHeaders,
	checkRateLimit,
	getRequestIp,
} from "~/server/rate-limit.server";

function parsePositiveInteger(
	value: string | undefined,
	fallback: number,
): number {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const DEFAULT_AUTH_RATE_LIMIT_MAX_REQUESTS =
	process.env.NODE_ENV === "production" ? 30 : 500;

const AUTH_RATE_LIMIT_WINDOW_MS = parsePositiveInteger(
	process.env.AUTH_RATE_LIMIT_WINDOW_MS,
	60_000,
);
const AUTH_RATE_LIMIT_MAX_REQUESTS = parsePositiveInteger(
	process.env.AUTH_RATE_LIMIT_MAX_REQUESTS,
	DEFAULT_AUTH_RATE_LIMIT_MAX_REQUESTS,
);

function requiresHubOAuthHandler(request: Request): boolean {
	const url = new URL(request.url);
	return (
		url.pathname.endsWith("/api/auth/sign-in/oauth2") ||
		url.pathname.includes("/api/auth/oauth2/")
	);
}

async function handleAuthRequest(params: {
	request: Request;
}): Promise<Response> {
	const startedAt = Date.now();
	const requestId = getRequestId(params.request);
	const requestContext = buildRequestContext({
		request: params.request,
		requestId,
	});
	const ip = getRequestIp(params.request);
	const flow = requiresHubOAuthHandler(params.request)
		? "hub_oauth"
		: "local_auth";
	const rateLimitResult = checkRateLimit({
		bucket: "auth:endpoints",
		key: `ip:${ip}`,
		limit: AUTH_RATE_LIMIT_MAX_REQUESTS,
		windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
	});
	const rateLimitHeaders = buildRateLimitHeaders({ result: rateLimitResult });
	if (!rateLimitResult.allowed) {
		recordAuthFlowMetric({ flow, outcome: "rate_limited" });
		logWarn({
			event: "auth.rate_limited",
			data: {
				...requestContext,
				ip,
				retryAfterSeconds: rateLimitResult.retryAfterSeconds,
			},
		});
		return new Response(JSON.stringify({ error: "Too many auth requests" }), {
			status: 429,
			headers: {
				"Content-Type": "application/json",
				"X-Request-Id": requestId,
				...rateLimitHeaders,
			},
		});
	}

	try {
		const auth = requiresHubOAuthHandler(params.request)
			? await getBetterAuthForHubOAuth()
			: getBetterAuth();
		const response = await auth.handler(params.request);
		recordAuthFlowMetric({
			flow,
			outcome: response.status >= 400 ? "failure" : "success",
		});
		const headers = new Headers(response.headers);
		for (const [key, value] of Object.entries(rateLimitHeaders)) {
			headers.set(key, value);
		}
		headers.set("X-Request-Id", requestId);
		logInfo({
			event: "auth.request.completed",
			data: {
				...requestContext,
				statusCode: response.status,
				durationMs: Date.now() - startedAt,
			},
		});

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	} catch (_error) {
		void captureMonitoredError({
			event: "auth.request.failed",
			error: _error,
			request: params.request,
			tags: { flow },
		});
		recordAuthFlowMetric({ flow, outcome: "failure" });
		logError({
			event: "auth.request.failed",
			data: {
				...requestContext,
				durationMs: Date.now() - startedAt,
			},
		});
		return new Response(JSON.stringify({ error: "Auth unavailable" }), {
			status: 503,
			headers: {
				"Content-Type": "application/json",
				"X-Request-Id": requestId,
				...rateLimitHeaders,
			},
		});
	}
}

export async function loader({ request }: LoaderFunctionArgs) {
	return handleAuthRequest({ request });
}

export async function action({ request }: ActionFunctionArgs) {
	return handleAuthRequest({ request });
}
