import type { ActionFunctionArgs } from "react-router";
import {
	type AgentAuthResult,
	authenticateAgentRequest,
} from "../server/agent-auth.server.ts";
import {
	agentAuthErrorResponse,
	agentJsonError,
	agentJsonSuccess,
	agentRateLimitedResponse,
	checkAgentRouteRateLimit,
	readAgentJsonBody,
	resolveAgentRequestId,
} from "../server/agent-api.server.ts";
import { writeAuditLogSafely } from "../server/audit-log.service.server.ts";
import { createNotification } from "../server/notification.service.server.ts";
import { hasSubjectScope } from "../server/permissions.server.ts";

type AgentNotificationDb = {
	instanceMembership: {
		findFirst: (args: {
			where: {
				instanceId: string;
				principalId: string;
				principalType: "user";
				approvalStatus: "approved";
			};
			select: {
				principalId: true;
			};
		}) => Promise<{ principalId: string } | null>;
	};
};

type AgentNotificationPayload = {
	userId?: unknown;
	title?: unknown;
	body?: unknown;
	targetUrl?: unknown;
};

function isValidAgentNotificationTargetUrl(value: string): boolean {
	return value.startsWith("/") && !value.startsWith("//");
}

export async function createAgentNotification(params: {
	request: Request;
	authenticate?: (params: { request: Request }) => Promise<AgentAuthResult>;
	db?: AgentNotificationDb;
	createNotificationFn?: typeof createNotification;
	writeAuditLog?: typeof writeAuditLogSafely;
	rateLimit?: (params: {
		request: Request;
		agentId?: string;
		routeType: "write";
	}) => {
		allowed: boolean;
		limit: number;
		remaining: number;
		resetAtMs: number;
		retryAfterSeconds: number;
	};
}): Promise<Response> {
	const requestId = resolveAgentRequestId({ request: params.request });
	const authenticate =
		params.authenticate ??
		((requestParams: { request: Request }) =>
			authenticateAgentRequest({
				request: requestParams.request,
			}));
	const auth = await authenticate({ request: params.request });
	const rateLimitResult = (params.rateLimit ?? checkAgentRouteRateLimit)({
		request: params.request,
		agentId: auth.ok ? auth.agent.id : undefined,
		routeType: "write",
	});
	if (!rateLimitResult.allowed) {
		return agentRateLimitedResponse({
			requestId,
			result: rateLimitResult,
		});
	}
	if (!auth.ok) {
		return agentAuthErrorResponse(auth, requestId);
	}

	if (
		!hasSubjectScope({
			subjectContext: auth.subjectContext,
			scope: "instance.notifications.create",
		})
	) {
		return agentJsonError({
			requestId,
			status: 403,
			code: "forbidden",
			message: "Agent cannot create notifications.",
			details: { reason: "missing_scope" },
		});
	}

	const parsedBody = await readAgentJsonBody<AgentNotificationPayload>({
		request: params.request,
		requestId,
	});
	if (!parsedBody.ok) {
		return parsedBody.response;
	}

	const userId = String(parsedBody.value.userId ?? "").trim();
	const title = String(parsedBody.value.title ?? "").trim();
	const body = String(parsedBody.value.body ?? "").trim();
	const targetUrlRaw = String(parsedBody.value.targetUrl ?? "").trim();
	const targetUrl = targetUrlRaw || undefined;

	if (!userId || !title || !body) {
		return agentJsonError({
			requestId,
			status: 400,
			code: "validation_error",
			message: "userId, title, and body are required.",
		});
	}

	if (targetUrl && !isValidAgentNotificationTargetUrl(targetUrl)) {
		return agentJsonError({
			requestId,
			status: 400,
			code: "validation_error",
			message: "targetUrl must be an app-relative path.",
		});
	}

	const db = params.db ?? (await import("../server/db.server.ts")).getDb();
	const membership = await db.instanceMembership.findFirst({
		where: {
			instanceId: auth.agent.instanceId,
			principalId: userId,
			principalType: "user",
			approvalStatus: "approved",
		},
		select: {
			principalId: true,
		},
	});
	if (!membership) {
		return agentJsonError({
			requestId,
			status: 404,
			code: "not_found",
			message: "Target user not found in this instance.",
		});
	}

	const notification = await (params.createNotificationFn ?? createNotification)({
		userId,
		kind: "agent_message",
		title,
		body,
		targetUrl,
		payload: {
			agentId: auth.agent.id,
		},
	});

	await (params.writeAuditLog ?? writeAuditLogSafely)({
		action: "agent.notification.create",
		actor: {
			type: "agent",
			id: auth.agent.id,
		},
		resourceType: "notification",
		resourceId: notification.id,
		request: params.request,
		payload: {
			requestId,
			userId,
			kind: "agent_message",
		},
	});

	return agentJsonSuccess(
		{
			notification,
		},
		{
			requestId,
			status: 201,
		},
	);
}

export async function action({
	request,
}: ActionFunctionArgs): Promise<Response> {
	return createAgentNotification({ request });
}
