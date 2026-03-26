import * as React from "react";
import { Form } from "react-router";
import { AppShell } from "~/components/app-shell";
import { PostAssetDisplay } from "~/components/post/post-asset-display";
import { PostAssetInput } from "~/components/post/post-asset-input";
import { PostComposer } from "~/components/post/post-composer";
import { PostContent } from "~/components/post/post-content";
import { PostHeader } from "~/components/post/post-header";
import { PostRichTextContent } from "~/components/post/post-rich-text-content";
import { Container } from "~/components/ui/container";
import { ContextBar } from "~/components/ui/context-bar";
import { FeedContainer } from "~/components/ui/feed-container";
import { plainTextToRichTextDocument } from "~/lib/rich-text";
import {
	canReplyToThread,
	countThreadReplies,
	PostDetailComments,
} from "./post-detail-comments";
import type { PostDetailLoaderData } from "./route.server";

function getPostTrailLabel(bodyText?: string | null) {
	const compact = (bodyText ?? "").trim().replace(/\s+/g, " ");
	if (compact.length <= 48) {
		return compact || "(no text)";
	}
	return `${compact.slice(0, 45).trim()}...`;
}

export function PostDetailPage(params: {
	actionData: { error: string } | undefined;
	data: PostDetailLoaderData;
	loading: boolean;
}) {
	const post = params.data.status !== "not_found" ? params.data.post : null;
	const replyResetKey = post
		? `${post.id}:${countThreadReplies(post)}`
		: "post-detail";
	const [activeReplyId, setActiveReplyId] = React.useState<string | null>(null);

	React.useEffect(() => {
		void replyResetKey;
		setActiveReplyId(null);
	}, [replyResetKey]);

	if (params.data.status === "not_setup") {
		return (
			<AppShell authUser={params.data.authUser}>
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Setup is not completed.
				</div>
			</AppShell>
		);
	}

	if (params.data.status === "not_found" || !post) {
		return (
			<AppShell authUser={params.data.authUser}>
				<FeedContainer>
					<div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
						Post not found.
					</div>
				</FeedContainer>
			</AppShell>
		);
	}

	const canReply = canReplyToThread(post, params.data.canReply);
	const breadcrumbs = [
		{ label: "Feed", to: "/feed" },
		...(post.group
			? [{ label: post.group.name, to: `/groups/${post.group.id}` }]
			: []),
		{ label: getPostTrailLabel(post.bodyText) },
	];
	const backTo = post.group ? `/groups/${post.group.id}` : "/feed";

	return (
		<AppShell authUser={params.data.authUser}>
			<FeedContainer className="space-y-4">
				<ContextBar backTo={backTo} breadcrumbs={breadcrumbs} />

				{params.actionData ? (
					<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{params.actionData.error}
					</div>
				) : null}

				<Container data-testid="post-detail-root" className="p-4">
					<PostHeader
						author={post.author}
						createdAt={post.createdAt}
						group={post.group}
						moderationStatus={post.moderationStatus}
						isHidden={post.isHidden}
						isDeleted={post.isDeleted}
					/>
					<PostContent className="mt-4">
						<PostRichTextContent
							document={plainTextToRichTextDocument(post.bodyText ?? "")}
						/>
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
							loading={params.loading}
							disabled={params.loading}
							submitLabel="Reply"
							submitTestId="post-detail-reply-submit"
							resetKey={replyResetKey}
							footer={
								<PostAssetInput
									previousAlbums={params.data.previousAlbums}
									inputTestId="post-detail-assets-input"
									albumInputTestId="post-detail-albums-input"
									videoInputTestId="post-detail-video-input"
									imageButtonTestId="post-detail-image-button"
									videoButtonTestId="post-detail-video-button"
									resetKey={replyResetKey}
								/>
							}
						/>
					</Form>
				) : null}

				<PostDetailComments
					activeReplyId={activeReplyId}
					canReply={params.data.canReply}
					loading={params.loading}
					post={post}
					previousAlbums={params.data.previousAlbums}
					replyResetKey={replyResetKey}
					setActiveReplyId={setActiveReplyId}
				/>
			</FeedContainer>
		</AppShell>
	);
}
