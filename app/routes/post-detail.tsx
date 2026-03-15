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
import {
	PostComposer,
	PostComposerBody,
	PostComposerField,
	PostComposerFooter,
	PostComposerMedia,
	PostComposerSurface,
} from "~/components/post/post-composer";
import { PostContent } from "~/components/post/post-content";
import { ProfileImage } from "~/components/profile/profile-image";
import { FeedContainer } from "~/components/ui/feed-container";
import { Icon } from "~/components/ui/icon";
import { IconButton } from "~/components/ui/icon-button";
import { cn } from "~/lib/utils";
import {
	type CommunityPost,
	type CommunityUser,
	createPost,
	loadCommunityPostThread,
} from "~/server/community.service.server";
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

function getInitials(name: string) {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

function countReplies(post: CommunityPost): number {
	return post.replies.reduce(
		(total, reply) => total + 1 + countReplies(reply),
		0,
	);
}

function canReplyAtThreadDepth(threadDepth: number) {
	return threadDepth < 3;
}

function ThreadCommentItem({ post }: { post: CommunityPost }) {
	const replyCount = countReplies(post);

	return (
		<div
			className={cn(
				"space-y-3",
				post.threadDepth > 1
					? "ml-4 border-l border-border/70 pl-4"
					: undefined,
			)}
			data-testid={`post-detail-comment-${post.id}`}
			data-thread-depth={post.threadDepth}
		>
			<article
				id={`post-${post.id}`}
				className="rounded-md border border-border p-3"
			>
				<PostContent
					createdAt={post.createdAt}
					moderationStatus={post.moderationStatus}
					isHidden={post.isHidden}
					isDeleted={post.isDeleted}
					actions={[
						{
							label: `Comments (${replyCount})`,
							to: `/posts/${post.id}`,
							testId: `post-detail-comment-action-${post.id}`,
						},
						{
							label: "Reply",
							to: `/posts/${post.id}`,
							testId: `post-detail-reply-action-${post.id}`,
						},
					]}
				>
					<p>{post.bodyText}</p>
				</PostContent>
			</article>
			{post.replies.length > 0 ? (
				<div className="space-y-3">
					{post.replies.map((reply) => (
						<ThreadCommentItem key={reply.id} post={reply} />
					))}
				</div>
			) : null}
		</div>
	);
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const postId = params.postId ?? "";
	const authUser = await getAuthUserFromRequest({ request });
	const user = toCommunityUser({ authUser });
	const result = await loadCommunityPostThread({ user, postId });

	if (result.status === "requires_registration") {
		const nextPath = new URL(request.url).pathname;
		const search = new URLSearchParams({
			next: nextPath,
			reason: "members-only",
		});
		return redirect(`/register?${search.toString()}`);
	}

	return {
		...result,
		authUser,
	};
}

export async function action({ request, params }: ActionFunctionArgs) {
	const authUser = await getAuthUserFromRequest({ request });
	const user = toCommunityUser({ authUser });
	if (!user) {
		return { error: "Sign in required" };
	}

	const formData = await request.formData();
	const actionType = String(formData.get("_action") ?? "");
	if (actionType !== "post") {
		return { error: "Unsupported action" };
	}

	const text = String(formData.get("bodyText") ?? "");
	const parentPostId =
		String(formData.get("parentPostId") ?? "").trim() ||
		params.postId ||
		undefined;
	const result = await createPost({
		user,
		text,
		parentPostId,
	});

	if (!result.ok) {
		return { error: result.error };
	}

	return redirect(`/posts/${params.postId ?? ""}`);
}

export default function PostDetailPage() {
	const data = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const loading = navigation.state === "submitting";

	if (data.status === "not_setup") {
		return (
			<AppShell authUser={data.authUser}>
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Setup is not completed.
				</div>
			</AppShell>
		);
	}

	if (data.status === "not_found" || !data.post) {
		return (
			<AppShell authUser={data.authUser}>
				<FeedContainer>
					<div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
						Post not found.
					</div>
				</FeedContainer>
			</AppShell>
		);
	}

	const canReply =
		Boolean(data.authUser) && canReplyAtThreadDepth(data.post.threadDepth);

	return (
		<AppShell authUser={data.authUser}>
			<FeedContainer className="space-y-4">
				<div>
					<Link
						to="/feed"
						className="text-sm text-muted-foreground hover:text-foreground"
					>
						Back to feed
					</Link>
				</div>

				{actionData && "error" in actionData ? (
					<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{actionData.error}
					</div>
				) : null}

				<article
					className="rounded-md border border-border p-3"
					data-testid="post-detail-root"
				>
					{data.post.group ? (
						<p className="mb-3 text-xs text-muted-foreground">
							Group:{" "}
							<Link
								to={`/groups/${data.post.group.id}`}
								className="font-medium text-foreground hover:underline"
							>
								{data.post.group.name}
							</Link>
						</p>
					) : null}
					<PostContent
						createdAt={data.post.createdAt}
						moderationStatus={data.post.moderationStatus}
						isHidden={data.post.isHidden}
						isDeleted={data.post.isDeleted}
					>
						<p>{data.post.bodyText}</p>
					</PostContent>
				</article>

				{canReply ? (
					<Form method="post">
						<input type="hidden" name="_action" value="post" />
						<input type="hidden" name="parentPostId" value={data.post.id} />
						<PostComposer variant="reply" className="items-start">
							<PostComposerMedia>
								<ProfileImage
									alt={data.authUser?.name ?? "You"}
									fallback={getInitials(data.authUser?.name ?? "You")}
									size="sm"
								/>
							</PostComposerMedia>
							<PostComposerBody>
								<PostComposerSurface>
									<PostComposerField
										name="bodyText"
										placeholder="Write a reply"
										data-testid="post-detail-reply-body"
									/>
									<PostComposerFooter className="justify-end gap-1 px-2 py-1.5">
										<IconButton
											type="submit"
											label="Reply"
											disabled={loading}
											data-testid="post-detail-reply-submit"
										>
											{loading ? (
												<Icon name="loaderCircle" className="animate-spin" />
											) : (
												<Icon name="sendHorizontal" />
											)}
										</IconButton>
									</PostComposerFooter>
								</PostComposerSurface>
							</PostComposerBody>
						</PostComposer>
					</Form>
				) : null}

				<section className="space-y-3" data-testid="post-detail-comments">
					<h2 className="text-lg font-semibold">Comments</h2>
					{data.post.replies.length === 0 ? (
						<p className="text-sm text-muted-foreground">No comments yet.</p>
					) : (
						data.post.replies.map((reply) => (
							<ThreadCommentItem key={reply.id} post={reply} />
						))
					)}
				</section>
			</FeedContainer>
		</AppShell>
	);
}
