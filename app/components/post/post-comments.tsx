import { PostComment, type PostCommentData } from "./post-comment";

export type { PostCommentData } from "./post-comment";

type PostCommentsProps = {
	comments: PostCommentData[];
};

function CommentTree({ comments }: { comments: PostCommentData[] }) {
	return (
		<div className="space-y-3">
			{comments.map((comment) => (
				<div key={comment.id} className="space-y-3">
					<PostComment comment={comment} />
					{comment.replies?.length ? (
						<CommentTree comments={comment.replies} />
					) : null}
				</div>
			))}
		</div>
	);
}

export function PostComments({ comments }: PostCommentsProps) {
	if (comments.length === 0) {
		return (
			<div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
				No comments yet.
			</div>
		);
	}

	return <CommentTree comments={comments} />;
}
