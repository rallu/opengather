import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
	Form,
	redirect,
	useActionData,
	useLoaderData,
	useNavigation,
} from "react-router";

import { AppShell } from "~/components/app-shell";
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

function mapComment(post: CommunityPost): PostCommentData {
	const replyCount = countReplies(post);

	return {
		id: post.id,
		testId: `post-detail-comment-${post.id}`,
		threadDepth: post.threadDepth,
		author: "Member",
		fallback: "M",
		body: post.bodyText ?? "",
		createdAt: post.createdAt,
		moderationStatus: post.moderationStatus,
		isHidden: post.isHidden,
		isDeleted: post.isDeleted,
		actions: [
			{
				label: replyCount === 1 ? "1 reply" : `${replyCount} replies`,
				to: `/posts/${post.id}`,
				testId: `post-detail-comment-action-${post.id}`,
			},
			{
				label: "Reply",
				to: `/posts/${post.id}`,
				testId: `post-detail-reply-action-${post.id}`,
			},
		],
		replies: post.replies.map(mapComment),
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
	const breadcrumbs = [
		{ label: "Feed", to: "/feed" },
		...(data.post.group
			? [
					{
						label: data.post.group.name,
						to: `/groups/${data.post.group.id}`,
					},
				]
			: []),
		{ label: getPostTrailLabel(data.post.bodyText) },
	];
	const backTo = data.post.group ? `/groups/${data.post.group.id}` : "/feed";

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
						createdAt={data.post.createdAt}
						moderationStatus={data.post.moderationStatus}
						isHidden={data.post.isHidden}
						isDeleted={data.post.isDeleted}
					>
						<p>{data.post.bodyText}</p>
					</PostContent>
				</Container>

				{canReply ? (
					<Form method="post">
						<input type="hidden" name="_action" value="post" />
						<input type="hidden" name="parentPostId" value={data.post.id} />
						<PostComposer
							variant="reply"
							name="bodyText"
							placeholder="Write a reply"
							textareaTestId="post-detail-reply-body"
							loading={loading}
							disabled={loading}
							submitLabel="Reply"
							submitTestId="post-detail-reply-submit"
						/>
					</Form>
				) : null}

				<section className="space-y-3" data-testid="post-detail-comments">
					<PostComments comments={data.post.replies.map(mapComment)} />
				</section>
			</FeedContainer>
		</AppShell>
	);
}
