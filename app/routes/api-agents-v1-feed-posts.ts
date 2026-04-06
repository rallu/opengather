import { randomUUID } from "node:crypto";
import type { ActionFunctionArgs } from "react-router";
import {
	agentAuthErrorResponse,
	agentJsonError,
	agentJsonSuccess,
	agentRateLimitedResponse,
	checkAgentRouteRateLimit,
	readAgentJsonBody,
	resolveAgentRequestId,
} from "../server/agent-api.server.ts";
import {
	type AgentAuthResult,
	authenticateAgentRequest,
} from "../server/agent-auth.server.ts";
import { writeAuditLogSafely } from "../server/audit-log.service.server.ts";
import { toTextVector } from "../server/embedding.service.server.ts";
import { canSubjectPostToInstanceFeed } from "../server/permissions.server.ts";

type AgentFeedPostDb = {
	$transaction: <T>(
		callback: (trx: {
			post: {
				create: (args: {
					data: {
						id: string;
						instanceId: string;
						authorId: string;
						authorType: "agent";
						groupId: null;
						rootPostId: string;
						parentPostId: null;
						contentType: "text";
						bodyText: string;
						moderationStatus: string;
						hiddenAt: null;
						deletedAt: null;
						createdAt: Date;
						updatedAt: Date;
					};
				}) => Promise<unknown>;
			};
			postEmbedding: {
				create: (args: {
					data: {
						id: string;
						postId: string;
						sourceType: "text";
						modelName: string;
						vector: number[];
						summaryText: string;
						createdAt: Date;
					};
				}) => Promise<unknown>;
			};
			moderationDecision: {
				create: (args: {
					data: {
						id: string;
						postId: string;
						status: string;
						reason: string;
						actorType: "ai";
						actorId: null;
						modelName: string;
						createdAt: Date;
					};
				}) => Promise<unknown>;
			};
		}) => Promise<T>,
	) => Promise<T>;
};

type AgentFeedPostPayload = {
	bodyText?: unknown;
};

export async function createAgentFeedPost(params: {
	request: Request;
	authenticate?: (params: { request: Request }) => Promise<AgentAuthResult>;
	db?: AgentFeedPostDb;
	now?: Date;
	generateId?: () => string;
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

	const parsedBody = await readAgentJsonBody<AgentFeedPostPayload>({
		request: params.request,
		requestId,
	});
	if (!parsedBody.ok) {
		return parsedBody.response;
	}

	const bodyText = String(parsedBody.value.bodyText ?? "").trim();
	if (!bodyText) {
		return agentJsonError({
			requestId,
			status: 400,
			code: "validation_error",
			message: "bodyText is required.",
		});
	}

	const canPost = canSubjectPostToInstanceFeed({
		subjectContext: auth.subjectContext,
	});
	if (!canPost.allowed) {
		return agentJsonError({
			requestId,
			status: 403,
			code: "forbidden",
			message: "Agent cannot post to the instance feed.",
			details: { reason: canPost.reason },
		});
	}

	const db = (params.db ??
		(await import("../server/db.server.ts")).getDb()) as AgentFeedPostDb;
	const now = params.now ?? new Date();
	const generateId = params.generateId ?? randomUUID;
	const postId = generateId();
	const moderationStatus = bodyText.toLowerCase().includes("illegal")
		? "rejected"
		: bodyText.toLowerCase().includes("spam") ||
				bodyText.toLowerCase().includes("scam")
			? "flagged"
			: "approved";

	await db.$transaction(async (trx) => {
		await trx.post.create({
			data: {
				id: postId,
				instanceId: auth.agent.instanceId,
				authorId: auth.agent.id,
				authorType: "agent",
				groupId: null,
				rootPostId: postId,
				parentPostId: null,
				contentType: "text",
				bodyText,
				moderationStatus,
				hiddenAt: null,
				deletedAt: null,
				createdAt: now,
				updatedAt: now,
			},
		});

		await trx.postEmbedding.create({
			data: {
				id: generateId(),
				postId,
				sourceType: "text",
				modelName: "local-deterministic-embedding",
				vector: toTextVector({ text: bodyText }),
				summaryText: bodyText,
				createdAt: now,
			},
		});

		await trx.moderationDecision.create({
			data: {
				id: generateId(),
				postId,
				status: moderationStatus,
				reason:
					moderationStatus === "approved"
						? "automated-approval"
						: "automated-policy-hit",
				actorType: "ai",
				actorId: null,
				modelName: "local-rule-moderation",
				createdAt: now,
			},
		});
	});

	await (params.writeAuditLog ?? writeAuditLogSafely)({
		action: "agent.post.create",
		actor: {
			type: "agent",
			id: auth.agent.id,
		},
		resourceType: "post",
		resourceId: postId,
		request: params.request,
		payload: {
			requestId,
			scope: "instance.feed.post",
			moderationStatus,
		},
	});

	return agentJsonSuccess(
		{
			post: {
				id: postId,
				bodyText,
				moderationStatus,
				createdAt: now.toISOString(),
				author: {
					type: "agent",
					id: auth.agent.id,
					displayName: auth.agent.displayLabel ?? auth.agent.displayName,
				},
			},
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
	return createAgentFeedPost({ request });
}
