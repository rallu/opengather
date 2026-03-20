import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
	Form,
	Link,
	redirect,
	useActionData,
	useLoaderData,
	useLocation,
	useNavigation,
} from "react-router";
import { AppShell } from "~/components/app-shell";
import { PostActionItem, PostActions } from "~/components/post/post-actions";
import { PostAssetDisplay } from "~/components/post/post-asset-display";
import { PostAssetInput } from "~/components/post/post-asset-input";
import { PostComposer } from "~/components/post/post-composer";
import { PostContent } from "~/components/post/post-content";
import {
	PostListSortToggle,
	ThreadFeedList,
} from "~/components/post/thread-feed-list";
import { Button } from "~/components/ui/button";
import { Container } from "~/components/ui/container";
import { FeedContainer } from "~/components/ui/feed-container";
import { writeAuditLogSafely } from "~/server/audit-log.service.server";
import {
	type CommunityUser,
	type CreatedPostSummary,
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
import { extractPostUploadsFromMultipartRequest } from "~/server/post-assets.server";
import {
	type PostListItem,
	parsePostListSortMode,
} from "~/server/post-list.service.server";
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

function getDiscussionLabel(replyCount: number) {
	if (replyCount === 0) {
		return "Start discussion";
	}
	return replyCount === 1 ? "1 comment" : `${replyCount} comments`;
}

function toPriorityPostListItem(params: {
	post: CreatedPostSummary;
	sortMode: "activity" | "newest";
}): PostListItem {
	return {
		id: params.post.id,
		parentPostId: params.post.parentPostId,
		threadDepth: 0,
		bodyText: params.post.bodyText,
		assets: params.post.assets,
		group: params.post.group,
		moderationStatus: params.post.moderationStatus,
		isHidden: params.post.isHidden,
		isDeleted: params.post.isDeleted,
		createdAt: params.post.createdAt,
		commentCount: params.post.commentCount,
		latestActivityAt: params.post.latestActivityAt,
		sortMode: params.sortMode,
	};
}

function isSuccessfulPostAction(
	actionData: ReturnType<typeof useActionData<typeof action>>,
): actionData is { ok: true; actionType: "post"; createdPost: PostListItem } {
	return Boolean(
		actionData &&
			"ok" in actionData &&
			actionData.ok &&
			actionData.actionType === "post" &&
			"createdPost" in actionData &&
			actionData.createdPost,
	);
}

function CommunityFeedItem(params: { post: PostListItem; isAdmin: boolean }) {
	const { post, isAdmin } = params;
	const postRoute = `/posts/${post.id}`;

	return (
		<div
			className="space-y-3"
			data-testid={`feed-post-${post.id}`}
			data-thread-depth={post.threadDepth}
		>
			<Container
				id={`post-${post.id}`}
				className="rounded-lg border-border/50 bg-card p-4 transition-colors hover:border-primary/12 sm:p-5"
			>
				<Link
					to={postRoute}
					className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
					data-testid={`feed-thread-link-${post.id}`}
				>
					{post.group ? (
						<div className="mb-4 text-sm text-muted-foreground">
							<span className="font-medium text-foreground">
								{post.group.name}
							</span>
						</div>
					) : null}
					<PostContent
						createdAt={post.createdAt}
						moderationStatus={post.moderationStatus}
						isHidden={post.isHidden}
						isDeleted={post.isDeleted}
						className="space-y-4"
					>
						<p className="text-[15px] leading-8">{post.bodyText}</p>
						<PostAssetDisplay assets={post.assets} playableVideo={false} />
					</PostContent>
				</Link>
				<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
					<PostActions className="gap-2">
						<PostActionItem
							asChild
							data-testid={`feed-comment-action-${post.id}`}
						>
							<Link to={postRoute}>
								{getDiscussionLabel(post.commentCount)}
							</Link>
						</PostActionItem>
					</PostActions>

					{isAdmin ? (
						<div className="flex flex-wrap items-center gap-2">
							<Form method="post">
								<input type="hidden" name="_action" value="moderate" />
								<input type="hidden" name="postId" value={post.id} />
								<input type="hidden" name="status" value="approved" />
								<Button
									type="submit"
									variant="outline"
									className="rounded-full"
								>
									Approve
								</Button>
							</Form>
							<Form method="post">
								<input type="hidden" name="_action" value="moderate" />
								<input type="hidden" name="postId" value={post.id} />
								<input type="hidden" name="status" value="rejected" />
								<Button
									type="submit"
									variant="outline"
									className="rounded-full"
								>
									Hide
								</Button>
							</Form>
							<Form method="post">
								<input type="hidden" name="_action" value="delete" />
								<input type="hidden" name="postId" value={post.id} />
								<Button
									type="submit"
									variant="outline"
									className="rounded-full"
								>
									Delete
								</Button>
							</Form>
						</div>
					) : null}
				</div>
			</Container>
		</div>
	);
}

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const sortMode = parsePostListSortMode(url.searchParams.get("sort"));

	try {
		const authUser = await getAuthUserFromRequest({ request });
		const user = toCommunityUser({ authUser });
		const data = await loadCommunity({ user, sortMode });
		if (data.status === "requires_registration") {
			const nextPath = url.pathname;
			const params = new URLSearchParams({
				next: nextPath,
				reason: "members-only",
			});
			return redirect(`/register?${params.toString()}`);
		}

		return {
			...data,
			sortMode,
			apiPath: `/api/post-list?scope=community&sort=${sortMode}`,
			authUser,
		};
	} catch {
		return {
			status: "not_setup" as const,
			viewerRole: "guest" as const,
			page: {
				items: [],
				hasMore: false,
				sortMode,
			},
			sortMode,
			apiPath: `/api/post-list?scope=community&sort=${sortMode}`,
			authUser: null,
		};
	}
}

export async function action({ request }: ActionFunctionArgs) {
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
				ok: true as const,
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
			return { ok: true as const, actionType };
		}

		if (actionType === "delete") {
			const postId = String(formData?.get("postId") ?? "");
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
			return { ok: true as const, actionType };
		}

		await multipart?.cleanup().catch(() => undefined);
		return { error: "Unsupported action" };
	} catch (error) {
		await multipart?.cleanup().catch(() => undefined);
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
	const location = useLocation();
	const navigation = useNavigation();
	const loading = navigation.state === "submitting";
	const successfulPostAction = isSuccessfulPostAction(actionData)
		? actionData
		: null;
	const composerResetKey = successfulPostAction?.createdPost.id;
	const priorityPost =
		successfulPostAction &&
		successfulPostAction.createdPost.parentPostId === undefined
			? successfulPostAction.createdPost
			: undefined;
	const buildSortHref = (sortMode: "activity" | "newest") =>
		`${location.pathname}?sort=${sortMode}`;
	const communityAside = (
		<>
			<Container className="rounded-lg border-border/50 bg-card">
				<div className="grid grid-cols-2 gap-3 p-5 text-sm">
					<div className="rounded-xl bg-muted/50 p-3">
						<p className="text-sm text-muted-foreground">Loaded threads</p>
						<p className="mt-2 text-2xl font-semibold text-foreground">
							{data.page.items.length}
						</p>
					</div>
					<div className="rounded-xl bg-muted/50 p-3">
						<p className="text-sm text-muted-foreground">Active sort</p>
						<p className="mt-2 text-2xl font-semibold text-foreground">
							{data.sortMode}
						</p>
					</div>
					<div className="col-span-2 rounded-xl border border-border/70 p-3 text-muted-foreground">
						<p className="font-medium text-foreground">
							Threads are ranked by recent activity or by root-post recency.
						</p>
						<p className="mt-1 text-sm">
							{data.authUser
								? "You can start a new thread from the composer above."
								: "Sign in to start discussions and reply to existing threads."}
						</p>
					</div>
				</div>
			</Container>
			<Container className="rounded-lg border-border/50 bg-card">
				<div className="space-y-2 p-5 text-sm text-muted-foreground">
					<p>Click the post body or heading area to open the full thread.</p>
					<p>
						New replies can bump older threads in `activity` mode without
						changing `newest` ordering.
					</p>
				</div>
			</Container>
		</>
	);

	return (
		<AppShell
			authUser={data.authUser}
			showServerSettings={data.viewerRole === "admin"}
			aside={communityAside}
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
				<div
					className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
					data-testid="feed-action-error"
				>
					{actionData.error}
				</div>
			) : null}

			<FeedContainer className="space-y-4">
				<div className="flex items-center justify-end">
					<PostListSortToggle
						sortMode={data.sortMode}
						buildHref={buildSortHref}
						prefix="feed"
					/>
				</div>

				{data.authUser && data.status === "ok" ? (
					<section>
						<Form method="post" encType="multipart/form-data">
							<input type="hidden" name="_action" value="post" />
							<input type="hidden" name="parentPostId" value={""} />
							<PostComposer
								name="bodyText"
								textareaTestId="feed-composer"
								placeholder="What's worth sharing right now?"
								loading={loading}
								disabled={loading || data.status !== "ok"}
								submitTestId="feed-post-button"
								submitClassName="h-9 w-9 bg-primary text-primary-foreground hover:bg-primary/90"
								resetKey={composerResetKey}
								footer={
									<div className="px-1">
										<PostAssetInput
											inputTestId="feed-assets-input"
											videoInputTestId="feed-video-input"
											imageButtonTestId="feed-image-button"
											videoButtonTestId="feed-video-button"
											resetKey={composerResetKey}
										/>
									</div>
								}
							/>
						</Form>
					</section>
				) : null}

				<ThreadFeedList
					key={`${location.pathname}-${data.sortMode}`}
					initialPage={data.page}
					apiPath={data.apiPath}
					listTestId="feed-post-list"
					sentinelTestId="feed-post-list-sentinel"
					loadingTestId="feed-post-list-loading"
					priorityItem={priorityPost}
					emptyState={
						<p className="text-sm text-muted-foreground">No posts yet.</p>
					}
					renderItem={(post) => (
						<CommunityFeedItem
							key={post.id}
							post={post}
							isAdmin={data.viewerRole === "admin"}
						/>
					)}
				/>
			</FeedContainer>
		</AppShell>
	);
}
