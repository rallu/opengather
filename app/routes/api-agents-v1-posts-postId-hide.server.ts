import type { ActionFunctionArgs } from "react-router";
import {
	agentAuthErrorResponse,
	agentJsonError,
	agentJsonSuccess,
	agentRateLimitedResponse,
	checkAgentRouteRateLimit,
	resolveAgentRequestId,
} from "../server/agent-api.server.ts";
import {
	type AgentAuthResult,
	authenticateAgentRequest,
} from "../server/agent-auth.server.ts";
import { writeAuditLogSafely } from "../server/audit-log.service.server.ts";
import { getDb } from "../server/db.server.ts";
import { processNotificationOutbox } from "../server/jobs.service.server.ts";
import { hasSubjectScope } from "../server/permissions.server.ts";

type AgentHidePostDb = {
	post: {
		updateMany: (args: {
			where: {
				id: string;
				instanceId: string;
			};
			data: {
				moderationStatus: "rejected";
				hiddenAt: Date;
				updatedAt: Date;
			};
		}) => Promise<{ count: number }>;
	};
	moderationDecision: {
		create: (args: {
			data: {
				id: string;
				postId: string;
				status: "rejected";
				reason: string;
				actorType: "agent";
				actorId: string;
				modelName: null;
				createdAt: Date;
			};
		}) => Promise<unknown>;
	};
};

export async function hideAgentPost(params: {
	request: Request;
	postId: string;
	authenticate?: (params: { request: Request }) => Promise<AgentAuthResult>;
	db?: AgentHidePostDb;
	now?: Date;
	generateId?: () => string;
	writeAuditLog?: typeof writeAuditLogSafely;
	processNotificationOutboxFn?: typeof processNotificationOutbox;
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
		auth.instanceRole !== "admin" ||
		!hasSubjectScope({
			subjectContext: auth.subjectContext,
			scope: "moderation.hide_post",
		})
	) {
		return agentJsonError({
			requestId,
			status: 403,
			code: "forbidden",
			message: "Agent cannot hide posts.",
			details: {
				reason:
					auth.instanceRole !== "admin" ? "admin_required" : "missing_scope",
			},
		});
	}

	const db = params.db ?? getDb();
	const now = params.now ?? new Date();
	const updated = await db.post.updateMany({
		where: {
			id: params.postId,
			instanceId: auth.agent.instanceId,
		},
		data: {
			moderationStatus: "rejected",
			hiddenAt: now,
			updatedAt: now,
		},
	});
	if (updated.count === 0) {
		return agentJsonError({
			requestId,
			status: 404,
			code: "not_found",
			message: "Post not found.",
		});
	}

	await db.moderationDecision.create({
		data: {
			id: params.generateId?.() ?? crypto.randomUUID(),
			postId: params.postId,
			status: "rejected",
			reason: "agent-hide-post",
			actorType: "agent",
			actorId: auth.agent.id,
			modelName: null,
			createdAt: now,
		},
	});

	await (params.processNotificationOutboxFn ?? processNotificationOutbox)({
		limit: 10,
	});

	await (params.writeAuditLog ?? writeAuditLogSafely)({
		action: "agent.post.hide",
		actor: {
			type: "agent",
			id: auth.agent.id,
		},
		resourceType: "post",
		resourceId: params.postId,
		request: params.request,
		payload: {
			requestId,
			status: "rejected",
			hide: true,
		},
	});

	return agentJsonSuccess(
		{
			post: {
				id: params.postId,
				moderationStatus: "rejected",
				hiddenAt: now.toISOString(),
			},
		},
		{
			requestId,
			status: 200,
		},
	);
}

export async function action({
	request,
	params,
}: ActionFunctionArgs): Promise<Response> {
	return hideAgentPost({
		request,
		postId: params.postId ?? "",
	});
}
