import type { Dispatch, SetStateAction } from "react";
import { Form } from "react-router";
import { PostAssetInput } from "~/components/post/post-asset-input";
import {
	type PostCommentData,
	PostComments,
} from "~/components/post/post-comments";
import { PostComposer } from "~/components/post/post-composer";
import type { CommunityPost } from "~/server/community.service.server";

function countReplies(post: CommunityPost): number {
	return post.replies.reduce(
		(total, reply) => total + 1 + countReplies(reply),
		0,
	);
}

function canReplyAtThreadDepth(threadDepth: number) {
	return threadDepth < 3;
}

function mapComment(params: {
	post: CommunityPost;
	activeReplyId: string | null;
	canReply: boolean;
	setActiveReplyId: Dispatch<SetStateAction<string | null>>;
}): PostCommentData {
	const { post, activeReplyId, canReply, setActiveReplyId } = params;
	const replyCount = countReplies(post);
	const canReplyHere = canReply && canReplyAtThreadDepth(post.threadDepth);

	return {
		id: post.id,
		testId: `post-detail-comment-${post.id}`,
		threadDepth: post.threadDepth,
		author: post.author.name,
		body: post.bodyText ?? "",
		assets: post.assets,
		createdAt: post.createdAt,
		imageSrc: post.author.imageSrc,
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

export function countThreadReplies(post: CommunityPost) {
	return countReplies(post);
}

export function canReplyToThread(post: CommunityPost, canReply: boolean) {
	return canReply && canReplyAtThreadDepth(post.threadDepth);
}

export function PostDetailComments(params: {
	activeReplyId: string | null;
	canReply: boolean;
	loading: boolean;
	post: CommunityPost;
	previousAlbums: string[];
	replyResetKey: string;
	setActiveReplyId: Dispatch<SetStateAction<string | null>>;
}) {
	const comments = params.post.replies.map((reply) =>
		mapComment({
			post: reply,
			activeReplyId: params.activeReplyId,
			canReply: params.canReply,
			setActiveReplyId: params.setActiveReplyId,
		}),
	);

	return (
		<section className="space-y-3" data-testid="post-detail-comments">
			<PostComments
				comments={comments}
				renderReplyComposer={(comment) =>
					params.activeReplyId === comment.id ? (
						<Form
							id={`post-detail-inline-reply-form-${comment.id}`}
							method="post"
							encType="multipart/form-data"
						>
							<input type="hidden" name="_action" value="post" />
							<input type="hidden" name="parentPostId" value={comment.id} />
							<PostComposer
								variant="reply"
								name="bodyText"
								placeholder="Write a reply"
								rows={3}
								loading={params.loading}
								disabled={params.loading}
								submitLabel="Reply"
								textareaTestId={`post-detail-inline-reply-body-${comment.id}`}
								submitTestId={`post-detail-inline-reply-submit-${comment.id}`}
								resetKey={params.replyResetKey}
								footer={
									<PostAssetInput
										formId={`post-detail-inline-reply-form-${comment.id}`}
										previousAlbums={params.previousAlbums}
										inputTestId={`post-detail-inline-assets-input-${comment.id}`}
										albumInputTestId={`post-detail-inline-albums-input-${comment.id}`}
										videoInputTestId={`post-detail-inline-video-input-${comment.id}`}
										imageButtonTestId={`post-detail-inline-image-button-${comment.id}`}
										videoButtonTestId={`post-detail-inline-video-button-${comment.id}`}
										resetKey={params.replyResetKey}
									/>
								}
							/>
						</Form>
					) : null
				}
			/>
		</section>
	);
}
