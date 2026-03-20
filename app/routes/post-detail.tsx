import * as React from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
	Form,
	redirect,
	useActionData,
	useLoaderData,
	useNavigation,
} from "react-router";

import { AppShell } from "~/components/app-shell";
import { PostAssetDisplay } from "~/components/post/post-asset-display";
import { PostAssetInput } from "~/components/post/post-asset-input";
import {
	type PostCommentData,
	PostComments,
} from "~/components/post/post-comments";
import { PostComposer } from "~/components/post/post-composer";
import { PostContent } from "~/components/post/post-content";
import { Container } from "~/components/ui/container";
import { ContextBar } from "~/components/ui/context-bar";
import { FeedContainer } from "~/components/ui/feed-container";
import {
	type CommunityPost,
	type CommunityUser,
	createPost,
	loadCommunityPostThread,
} from "~/server/community.service.server";
import { extractPostUploadsFromMultipartRequest } from "~/server/post-assets.server";
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

function countReplies(post: CommunityPost): number {
	return post.replies.reduce(
		(total, reply) => total + 1 + countReplies(reply),
		0,
	);
}

function canReplyAtThreadDepth(threadDepth: number) {
	return threadDepth < 3;
}

function getPostTrailLabel(bodyText?: string | null) {
	const compact = (bodyText ?? "").trim().replace(/\s+/g, " ");
	if (compact.length <= 48) {
		return compact || "(no text)";
	}
	return `${compact.slice(0, 45).trim()}...`;
}

function mapComment(params: {
	post: CommunityPost;
	activeReplyId: string | null;
	canReply: boolean;
	setActiveReplyId: React.Dispatch<React.SetStateAction<string | null>>;
}): PostCommentData {
	const { post, activeReplyId, canReply, setActiveReplyId } = params;
	const replyCount = countReplies(post);
	const canReplyHere = canReply && canReplyAtThreadDepth(post.threadDepth);

	return {
		id: post.id,
		testId: `post-detail-comment-${post.id}`,
		threadDepth: post.threadDepth,
		author: "Member",
		fallback: "M",
		body: post.bodyText ?? "",
		assets: post.assets,
		createdAt: post.createdAt,
		moderationStatus: post.moderationStatus,
		isHidden: post.isHidden,
		isDeleted: post.isDeleted,
		actions: [
			{
				label: replyCount === 1 ? "1 reply" : `${replyCount} replies`,
				disabled: true,
				testId: `post-detail-comment-action-${post.id}`,
			},
			...(canReplyHere
				? [
						{
							label: activeReplyId === post.id ? "Cancel reply" : "Reply",
							onClick: () =>
								setActiveReplyId((current) =>
									current === post.id ? null : post.id,
								),
							isActive: activeReplyId === post.id,
							testId: `post-detail-reply-action-${post.id}`,
						},
					]
				: []),
		],
		replies: post.replies.map((reply) =>
			mapComment({
				post: reply,
				activeReplyId,
				canReply,
				setActiveReplyId,
			}),
		),
	};
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

	let multipart: Awaited<
		ReturnType<typeof extractPostUploadsFromMultipartRequest>
	> | null = null;
	try {
		const isMultipart = (request.headers.get("content-type") ?? "")
			.toLowerCase()
			.includes("multipart/form-data");
		multipart = isMultipart
			? await extractPostUploadsFromMultipartRequest({ request })
			: null;
		const formData = multipart ? null : await request.formData();
		const actionType = multipart
			? multipart.actionType
			: String(formData?.get("_action") ?? "");
		if (actionType !== "post") {
			await multipart?.cleanup().catch(() => undefined);
			return { error: "Unsupported action" };
		}

		const text = multipart
			? multipart.bodyText
			: String(formData?.get("bodyText") ?? "");
		const parentPostId =
			multipart?.parentPostId ||
			String(formData?.get("parentPostId") ?? "").trim() ||
			params.postId ||
			undefined;
		const result = await createPost({
			user,
			text,
			parentPostId,
			uploads: multipart?.uploads ?? [],
		});
		await multipart?.cleanup();

		if (!result.ok) {
			return { error: result.error };
		}

		return redirect(`/posts/${params.postId ?? ""}`);
	} catch (error) {
		await multipart?.cleanup().catch(() => undefined);
		return {
			error: error instanceof Error ? error.message : "Request failed",
		};
	}
}

export default function PostDetailPage() {
	const data = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const loading = navigation.state === "submitting";
	const post = data.status !== "not_found" ? data.post : null;
	const replyResetKey = post
		? `${post.id}:${countReplies(post)}`
		: "post-detail";
	const [activeReplyId, setActiveReplyId] = React.useState<string | null>(null);
	React.useEffect(() => {
		void replyResetKey;
		setActiveReplyId(null);
	}, [replyResetKey]);

	if (data.status === "not_setup") {
		return (
			<AppShell authUser={data.authUser}>
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Setup is not completed.
				</div>
			</AppShell>
		);
	}

	if (data.status === "not_found" || !post) {
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

	const canReply = data.canReply && canReplyAtThreadDepth(post.threadDepth);
	const comments = post.replies.map((reply) =>
		mapComment({
			post: reply,
			activeReplyId,
			canReply: data.canReply,
			setActiveReplyId,
		}),
	);
	const breadcrumbs = [
		{ label: "Feed", to: "/feed" },
		...(post.group
			? [
					{
						label: post.group.name,
						to: `/groups/${post.group.id}`,
					},
				]
			: []),
		{ label: getPostTrailLabel(post.bodyText) },
	];
	const backTo = post.group ? `/groups/${post.group.id}` : "/feed";

	return (
		<AppShell authUser={data.authUser}>
			<FeedContainer className="space-y-4">
				<ContextBar backTo={backTo} breadcrumbs={breadcrumbs} />

				{actionData && "error" in actionData ? (
					<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{actionData.error}
					</div>
				) : null}

				<Container data-testid="post-detail-root" className="p-4">
					<PostContent
						createdAt={post.createdAt}
						moderationStatus={post.moderationStatus}
						isHidden={post.isHidden}
						isDeleted={post.isDeleted}
					>
						<p>{post.bodyText}</p>
						<PostAssetDisplay assets={post.assets} />
					</PostContent>
				</Container>

				{canReply ? (
					<Form method="post" encType="multipart/form-data">
						<input type="hidden" name="_action" value="post" />
						<input type="hidden" name="parentPostId" value={post.id} />
						<PostComposer
							variant="reply"
							name="bodyText"
							placeholder="Write a reply"
							textareaTestId="post-detail-reply-body"
							loading={loading}
							disabled={loading}
							submitLabel="Reply"
							submitTestId="post-detail-reply-submit"
							resetKey={replyResetKey}
							footer={
								<PostAssetInput
									inputTestId="post-detail-assets-input"
									videoInputTestId="post-detail-video-input"
									imageButtonTestId="post-detail-image-button"
									videoButtonTestId="post-detail-video-button"
									resetKey={replyResetKey}
								/>
							}
						/>
					</Form>
				) : null}

				<section className="space-y-3" data-testid="post-detail-comments">
					<PostComments
						comments={comments}
						renderReplyComposer={(comment) =>
							activeReplyId === comment.id ? (
								<Form method="post" encType="multipart/form-data">
									<input type="hidden" name="_action" value="post" />
									<input type="hidden" name="parentPostId" value={comment.id} />
									<PostComposer
										variant="reply"
										name="bodyText"
										placeholder="Write a reply"
										rows={3}
										loading={loading}
										disabled={loading}
										submitLabel="Reply"
										textareaTestId={`post-detail-inline-reply-body-${comment.id}`}
										submitTestId={`post-detail-inline-reply-submit-${comment.id}`}
										resetKey={replyResetKey}
										footer={
											<PostAssetInput
												inputTestId={`post-detail-inline-assets-input-${comment.id}`}
												videoInputTestId={`post-detail-inline-video-input-${comment.id}`}
												imageButtonTestId={`post-detail-inline-image-button-${comment.id}`}
												videoButtonTestId={`post-detail-inline-video-button-${comment.id}`}
												resetKey={replyResetKey}
											/>
										}
									/>
								</Form>
							) : null
						}
					/>
				</section>
			</FeedContainer>
		</AppShell>
	);
}
