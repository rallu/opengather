import { PostComment, type PostCommentData } from "./post-comment";

export type { PostCommentData } from "./post-comment";

type PostCommentsProps = {
	comments: PostCommentData[];
	renderReplyComposer?: (comment: PostCommentData) => React.ReactNode;
};

function CommentTree({
	comments,
	renderReplyComposer,
}: {
	comments: PostCommentData[];
	renderReplyComposer?: (comment: PostCommentData) => React.ReactNode;
}) {
	return (
		<div className="space-y-1.5">
			{comments.map((comment) => (
				<PostComment
					key={comment.id}
					comment={comment}
					replyComposer={renderReplyComposer?.(comment)}
				>
					{comment.replies?.length ? (
						<CommentTree
							comments={comment.replies}
							renderReplyComposer={renderReplyComposer}
						/>
					) : null}
				</PostComment>
			))}
		</div>
	);
}

export function PostComments({
	comments,
	renderReplyComposer,
}: PostCommentsProps) {
	if (comments.length === 0) {
		return (
			<div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
				No comments yet.
			</div>
		);
	}

	return (
		<CommentTree
			comments={comments}
			renderReplyComposer={renderReplyComposer}
		/>
	);
}
