import type { ActionFunctionArgs } from "react-router";
import { writeAuditLogSafely } from "~/server/audit-log.service.server";
import {
	createPost,
	moderatePost,
	softDeletePost,
} from "~/server/community.service.server";
import { captureMonitoredError } from "~/server/error-monitoring.server";
import {
	buildRequestContext,
	getRequestId,
	logError,
	logInfo,
	logWarn,
} from "~/server/logger.server";
import { recordPostMetric } from "~/server/metrics.server";
import { extractPostUploadsFromMultipartRequest } from "~/server/post-assets.server";
import type { PostListItem } from "~/server/post-list.service.server";
import { parsePostListSortMode } from "~/server/post-list.service.server";
import {
	buildRateLimitHeaders,
	checkRateLimit,
	getRequestIp,
} from "~/server/rate-limit.server";
import { getAuthUserFromRequest } from "~/server/session.server";
import { toCommunityUser, toPriorityPostListItem } from "./shared";

export type CommunityPostSuccessAction = {
	ok: true;
	actionType: "post";
	createdPost: PostListItem;
};

export type CommunityActionData =
	| CommunityPostSuccessAction
	| { ok: true; actionType: "moderate" | "delete" }
	| { error: string }
	| Response;

export async function action({
	request,
}: ActionFunctionArgs): Promise<CommunityActionData> {
	const startedAt = Date.now();
	const requestId = getRequestId(request);
	const sortMode = parsePostListSortMode(
		new URL(request.url).searchParams.get("sort"),
	);
	let multipart: Awaited<
		ReturnType<typeof extractPostUploadsFromMultipartRequest>
	> | null = null;
	let formData: FormData | null = null;
	let actionType = "";

	try {
		const isMultipart = (request.headers.get("content-type") ?? "")
			.toLowerCase()
			.includes("multipart/form-data");
		multipart = isMultipart
			? await extractPostUploadsFromMultipartRequest({ request })
			: null;
		formData = multipart ? null : await request.formData();
		actionType = multipart
			? multipart.actionType
			: String(formData?.get("_action") ?? "");
		const authUser = await getAuthUserFromRequest({ request });
		const requestContext = buildRequestContext({
			request,
			requestId,
			userId: authUser?.id,
		});
		const user = toCommunityUser({ authUser });

		if (actionType === "post") {
			const actorKey = authUser?.id
				? `user:${authUser.id}`
				: `ip:${getRequestIp(request)}`;
			const rateLimitResult = checkRateLimit({
				bucket: "community:post",
				key: actorKey,
				limit: 20,
				windowMs: 60_000,
			});
			if (!rateLimitResult.allowed) {
				recordPostMetric({ outcome: "rate_limited" });
				logWarn({
					event: "community.post.rate_limited",
					data: {
						...requestContext,
						actionType,
						actorKey,
						retryAfterSeconds: rateLimitResult.retryAfterSeconds,
					},
				});
				return new Response(
					JSON.stringify({ error: "Too many posts. Please retry shortly." }),
					{
						status: 429,
						headers: {
							"Content-Type": "application/json",
							"X-Request-Id": requestId,
							...buildRateLimitHeaders({ result: rateLimitResult }),
						},
					},
				);
			}

			const text = multipart
				? multipart.bodyText
				: String(formData?.get("bodyText") ?? "");
			const parentPostId = multipart
				? multipart.parentPostId
				: String(formData?.get("parentPostId") ?? "").trim() || undefined;
			const result = await createPost({
				user,
				text,
				albumTags: multipart?.albumTags ?? [],
				parentPostId,
				uploads: multipart?.uploads ?? [],
			});
			await multipart?.cleanup();

			if (!result.ok) {
				recordPostMetric({ outcome: "rejected" });
				logWarn({
					event: "community.post.rejected",
					data: {
						...requestContext,
						actionType,
						error: result.error,
					},
				});
				return { error: result.error };
			}

			logInfo({
				event: "community.post.created",
				data: {
					...requestContext,
					actionType,
					durationMs: Date.now() - startedAt,
					isReply: Boolean(parentPostId),
				},
			});
			recordPostMetric({ outcome: "created" });
			return {
				ok: true,
				actionType,
				createdPost: toPriorityPostListItem({
					post: result.createdPost,
					sortMode,
				}),
			};
		}

		if (actionType === "moderate") {
			const postId = String(formData?.get("postId") ?? "");
			const status = String(formData?.get("status") ?? "approved") as
				| "approved"
				| "rejected"
				| "flagged";
			const hide = status !== "approved";
			const result = await moderatePost({ user, postId, status, hide });
			if (!result.ok) {
				return { error: result.error };
			}
			await writeAuditLogSafely({
				action: "post.moderate",
				actor: { type: "user", id: authUser?.id },
				resourceType: "post",
				resourceId: postId,
				request,
				payload: { status, hide, outcome: "success" },
			});
			return { ok: true, actionType };
		}

		if (actionType === "delete") {
			const postId = String(formData?.get("postId") ?? "");
			const result = await softDeletePost({ user, postId });
			if (!result.ok) {
				return { error: result.error };
			}
			await writeAuditLogSafely({
				action: "post.delete",
				actor: { type: "user", id: authUser?.id },
				resourceType: "post",
				resourceId: postId,
				request,
				payload: { outcome: "success" },
			});
			return { ok: true, actionType };
		}

		await multipart?.cleanup().catch(() => undefined);
		return { error: "Unsupported action" };
	} catch (error) {
		await multipart?.cleanup().catch(() => undefined);
		void captureMonitoredError({
			event: "community.action.failed",
			error,
			request,
			tags: { actionType },
		});
		recordPostMetric({ outcome: "failed" });
		logError({
			event: "community.action.failed",
			data: {
				requestId,
				actionType,
				method: request.method,
				path: new URL(request.url).pathname,
				durationMs: Date.now() - startedAt,
			},
		});
		return { error: "Request failed" };
	}
}
