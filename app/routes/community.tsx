import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
	Form,
	Link,
	redirect,
	useActionData,
	useLoaderData,
	useNavigation,
} from "react-router";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import { writeAuditLogSafely } from "~/server/audit-log.service.server";
import {
	type CommunityUser,
	createPost,
	loadCommunity,
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
import {
	buildRateLimitHeaders,
	checkRateLimit,
	getRequestIp,
} from "~/server/rate-limit.server";
import { getAuthUserFromRequest } from "~/server/session.server";

function toCommunityUser(params: {
	authUser: Awaited<ReturnType<typeof getAuthUserFromRequest>>;
}): CommunityUser | null {
	if (!params.authUser) {
		return null;
	}
	return {
		id: params.authUser.id,
		hubUserId: params.authUser.hubUserId,
		role: "member",
	};
}

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const q = url.searchParams.get("q") ?? undefined;

	try {
		const authUser = await getAuthUserFromRequest({ request });
		const user = toCommunityUser({ authUser });
		const data = await loadCommunity({ user, query: q });
		if (data.status === "requires_registration") {
			const nextPath = `${url.pathname}${url.search}`;
			const params = new URLSearchParams({
				next: nextPath,
				reason: "members-only",
			});
			return redirect(`/register?${params.toString()}`);
		}

		return {
			...data,
			q: q ?? "",
			authUser,
		};
	} catch {
		return {
			status: "not_setup" as const,
			viewerRole: "guest" as const,
			posts: [],
			search: [],
			q: q ?? "",
			authUser: null,
		};
	}
}

export async function action({ request }: ActionFunctionArgs) {
	const startedAt = Date.now();
	const requestId = getRequestId(request);
	const formData = await request.formData();
	const actionType = String(formData.get("_action") ?? "");

	try {
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

			const text = String(formData.get("bodyText") ?? "");
			const parentPostId =
				String(formData.get("parentPostId") ?? "").trim() || undefined;
			const result = await createPost({ user, text, parentPostId });
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
			return { ok: true };
		}

		if (actionType === "moderate") {
			const postId = String(formData.get("postId") ?? "");
			const status = String(formData.get("status") ?? "approved") as
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
				actor: {
					type: "user",
					id: authUser?.id,
				},
				resourceType: "post",
				resourceId: postId,
				request,
				payload: {
					status,
					hide,
					outcome: "success",
				},
			});
			return { ok: true };
		}

		if (actionType === "delete") {
			const postId = String(formData.get("postId") ?? "");
			const result = await softDeletePost({ user, postId });
			if (!result.ok) {
				return { error: result.error };
			}
			await writeAuditLogSafely({
				action: "post.delete",
				actor: {
					type: "user",
					id: authUser?.id,
				},
				resourceType: "post",
				resourceId: postId,
				request,
				payload: {
					outcome: "success",
				},
			});
			return { ok: true };
		}

		return { error: "Unsupported action" };
	} catch (error) {
		void captureMonitoredError({
			event: "community.action.failed",
			error,
			request,
			tags: {
				actionType,
			},
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

export default function CommunityPage() {
	const data = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const loading = navigation.state === "submitting";

	return (
		<AppShell
			authUser={data.authUser}
			showServerSettings={data.viewerRole === "admin"}
			searchQuery={data.q}
		>
			{data.status === "not_setup" ? (
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					<span data-testid="feed-setup-error">Setup is not completed.</span>
				</div>
			) : null}

			{data.status === "forbidden" ? (
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Access denied.
				</div>
			) : null}

			{data.status === "pending_membership" ? (
				<div
					className="rounded-md border border-border bg-muted/40 p-4 text-sm"
					data-testid="feed-pending-state"
				>
					<p className="font-medium">Membership approval pending</p>
					<p className="mt-1 text-muted-foreground">
						Your account is waiting for approval before you can access this
						community feed.
					</p>
				</div>
			) : null}

			{actionData && "error" in actionData ? (
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					{actionData.error}
				</div>
			) : null}

			{data.authUser && data.status === "ok" ? (
				<div className="rounded-md border border-border p-4">
					<Form method="post" className="space-y-3">
						<input type="hidden" name="_action" value="post" />
						<input type="hidden" name="parentPostId" value={""} />
						<textarea
							name="bodyText"
							data-testid="feed-composer"
							className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
							placeholder="What's on your mind?"
						/>
						<Button
							type="submit"
							disabled={loading || data.status !== "ok"}
							data-testid="feed-post-button"
						>
							{loading ? "Saving..." : "Post"}
						</Button>
					</Form>
				</div>
			) : null}

			{data.q ? (
				<div className="rounded-md border border-border p-4">
					<p className="mb-3 text-sm text-muted-foreground">
						Results for{" "}
						<span className="font-medium text-foreground">{data.q}</span>
					</p>
					<div className="space-y-2">
						{data.search.map((item) => (
							<div
								key={item.post.id}
								className="rounded border border-border p-2 text-sm"
							>
								<p>{item.post.bodyText}</p>
								{item.post.group ? (
									<p className="mt-1 text-xs text-muted-foreground">
										Group:{" "}
										<Link
											to={`/groups/${item.post.group.id}`}
											className="hover:underline"
										>
											{item.post.group.name}
										</Link>
									</p>
								) : null}
								<p className="text-xs text-muted-foreground">
									score: {item.score.toFixed(4)}
								</p>
							</div>
						))}
						{data.search.length === 0 ? (
							<p className="text-sm text-muted-foreground">No matches.</p>
						) : null}
					</div>
				</div>
			) : null}

			<div className="space-y-2">
				{data.posts.length === 0 ? (
					<p className="text-sm text-muted-foreground">No posts yet.</p>
				) : null}
				{data.posts.map((post) => (
					<div
						key={post.id}
						id={`post-${post.id}`}
						className="rounded-md border border-border p-3"
					>
						<p className="text-sm">
							{post.group ? (
								<>
									<Link
										to={`/groups/${post.group.id}`}
										className="font-medium hover:underline"
									>
										{post.group.name}
									</Link>
									<span className="text-muted-foreground"> • </span>
								</>
							) : null}
							{post.parentPostId ? (
								<span className="text-muted-foreground">
									Reply to {post.parentPostId}:{" "}
								</span>
							) : null}
							{post.bodyText}
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							{post.moderationStatus} •{" "}
							{new Date(post.createdAt).toLocaleString()}
							{post.isHidden ? " • hidden" : ""}
							{post.isDeleted ? " • deleted" : ""}
						</p>
						<div className="mt-2 flex gap-2">
							{data.authUser && data.status === "ok" && !post.group ? (
								<Form method="post" className="inline-flex">
									<input type="hidden" name="_action" value="post" />
									<input type="hidden" name="parentPostId" value={post.id} />
									<input
										name="bodyText"
										placeholder="Reply"
										className="rounded-l-md border border-input bg-background px-3 py-2 text-sm"
									/>
									<Button
										type="submit"
										className="rounded-l-none"
										disabled={data.status !== "ok"}
									>
										Reply
									</Button>
								</Form>
							) : null}

							{post.group ? (
								<Button variant="outline" asChild>
									<Link to={`/groups/${post.group.id}#post-${post.id}`}>
										View in group
									</Link>
								</Button>
							) : null}

							{data.viewerRole === "admin" ? (
								<>
									<Form method="post">
										<input type="hidden" name="_action" value="moderate" />
										<input type="hidden" name="postId" value={post.id} />
										<input type="hidden" name="status" value="approved" />
										<Button type="submit" variant="outline">
											Approve
										</Button>
									</Form>
									<Form method="post">
										<input type="hidden" name="_action" value="moderate" />
										<input type="hidden" name="postId" value={post.id} />
										<input type="hidden" name="status" value="rejected" />
										<Button type="submit" variant="outline">
											Hide
										</Button>
									</Form>
									<Form method="post">
										<input type="hidden" name="_action" value="delete" />
										<input type="hidden" name="postId" value={post.id} />
										<Button type="submit" variant="outline">
											Delete
										</Button>
									</Form>
								</>
							) : null}
						</div>
					</div>
				))}
			</div>
		</AppShell>
	);
}
