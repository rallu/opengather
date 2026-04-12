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
import { resolveParentPostContext } from "../server/community.service.server/create-support.ts";
import { getDb } from "../server/db.server.ts";
import { toTextVector } from "../server/embedding.service.server.ts";
import {
	canSubjectReplyToGroup,
	canSubjectReplyToPost,
} from "../server/permissions.server.ts";

type AgentReplyDb = {
	$transaction: <T>(
		callback: (trx: {
			post: {
				create: (args: {
					data: {
						id: string;
						instanceId: string;
						authorId: string;
						authorType: "agent";
						groupId: string | null;
						rootPostId: string;
						parentPostId: string;
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

type ParentContextResult =
	| {
			ok: true;
			parent: {
				id: string;
				groupId: string | null;
				rootPostId: string;
			};
	  }
	| {
			ok: false;
			error: string;
	  };

type AgentReplyPayload = {
	bodyText?: unknown;
};

export async function createAgentReply(params: {
	request: Request;
	postId: string;
	authenticate?: (params: { request: Request }) => Promise<AgentAuthResult>;
	db?: AgentReplyDb;
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
	resolveParentContext?: (params: {
		instanceId: string;
		parentPostId: string;
	}) => Promise<ParentContextResult>;
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

	const parsedBody = await readAgentJsonBody<AgentReplyPayload>({
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

	const parentContext = await (
		params.resolveParentContext ?? resolveParentPostContext
	)({
		instanceId: auth.agent.instanceId,
		parentPostId: params.postId,
	});
	if (!parentContext.ok) {
		return agentJsonError({
			requestId,
			status: parentContext.error === "Parent post not found" ? 404 : 400,
			code:
				parentContext.error === "Parent post not found"
					? "not_found"
					: "validation_error",
			message: parentContext.error,
		});
	}

	const parent = parentContext.parent;
	const permission = parent.groupId
		? canSubjectReplyToGroup({
				subjectContext: auth.subjectContext,
				groupId: parent.groupId,
			})
		: canSubjectReplyToPost({
				subjectContext: auth.subjectContext,
			});
	if (!permission.allowed) {
		return agentJsonError({
			requestId,
			status: 403,
			code: "forbidden",
			message: parent.groupId
				? "Agent cannot reply in this group."
				: "Agent cannot reply to the instance feed.",
			details: { reason: permission.reason },
		});
	}

	const db = (params.db ?? getDb()) as AgentReplyDb;
	const now = params.now ?? new Date();
	const generateId = params.generateId ?? randomUUID;
	const replyId = generateId();
	const moderationStatus = bodyText.toLowerCase().includes("illegal")
		? "rejected"
		: bodyText.toLowerCase().includes("spam") ||
				bodyText.toLowerCase().includes("scam")
			? "flagged"
			: "approved";

	await db.$transaction(async (trx) => {
		await trx.post.create({
			data: {
				id: replyId,
				instanceId: auth.agent.instanceId,
				authorId: auth.agent.id,
				authorType: "agent",
				groupId: parent.groupId,
				rootPostId: parent.rootPostId || parent.id,
				parentPostId: parent.id,
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
				postId: replyId,
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
				postId: replyId,
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

	const scope = parent.groupId ? "group.reply" : "instance.feed.reply";
	await (params.writeAuditLog ?? writeAuditLogSafely)({
		action: "agent.reply.create",
		actor: {
			type: "agent",
			id: auth.agent.id,
		},
		resourceType: "post",
		resourceId: replyId,
		request: params.request,
		payload: {
			requestId,
			parentPostId: parent.id,
			groupId: parent.groupId ?? undefined,
			scope,
			moderationStatus,
		},
	});

	return agentJsonSuccess(
		{
			reply: {
				id: replyId,
				parentPostId: parent.id,
				groupId: parent.groupId ?? undefined,
				rootPostId: parent.rootPostId || parent.id,
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
	params,
}: ActionFunctionArgs): Promise<Response> {
	return createAgentReply({
		request,
		postId: params.postId ?? "",
	});
}
