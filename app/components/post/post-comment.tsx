import { ProfileImage } from "~/components/profile/profile-image";
import {
	ChatBubble,
	ChatBubbleBody,
	ChatBubbleContent,
	ChatBubbleFooter,
	ChatBubbleHeader,
	ChatBubbleHeading,
	ChatBubbleMedia,
	ChatBubbleMeta,
	ChatBubbleTitle,
} from "~/components/ui/chat-bubble";

import {
	type PostActionData,
	PostActionItem,
	PostActions,
} from "./post-actions";
import { PostContent } from "./post-content";
import { PostLabels } from "./post-labels";

export type PostCommentData = {
	id: string;
	threadDepth: number;
	author: string;
	body: string;
	createdAt: string;
	imageSrc?: string;
	fallback?: string;
	moderationStatus?: "pending" | "approved" | "rejected" | "flagged";
	isHidden?: boolean;
	isDeleted?: boolean;
	actions?: PostActionData[];
	replies?: PostCommentData[];
};

type PostCommentProps = {
	comment: PostCommentData;
};

export function PostComment({ comment }: PostCommentProps) {
	return (
		<div
			data-testid={`post-comment-${comment.id}`}
			style={{
				marginLeft:
					comment.threadDepth > 0
						? `${Math.min(comment.threadDepth, 3) * 1.25}rem`
						: undefined,
			}}
		>
			<ChatBubble>
				<ChatBubbleContent>
					<ChatBubbleHeader>
						<ChatBubbleMedia>
							<ProfileImage
								src={comment.imageSrc}
								alt={comment.author}
								fallback={
									comment.fallback ?? comment.author.slice(0, 2).toUpperCase()
								}
								size="sm"
							/>
						</ChatBubbleMedia>
						<ChatBubbleHeading>
							<ChatBubbleTitle className="flex flex-wrap items-center gap-2">
								<span>{comment.author}</span>
								<PostLabels
									moderationStatus={comment.moderationStatus}
									isHidden={comment.isHidden}
									isDeleted={comment.isDeleted}
								/>
							</ChatBubbleTitle>
							<ChatBubbleMeta>
								{new Date(comment.createdAt).toLocaleString()}
							</ChatBubbleMeta>
						</ChatBubbleHeading>
					</ChatBubbleHeader>
					<ChatBubbleBody>
						<PostContent>
							<p>{comment.body}</p>
						</PostContent>
					</ChatBubbleBody>
					{comment.actions?.length ? (
						<ChatBubbleFooter>
							<PostActions>
								{comment.actions.map((action) => (
									<PostActionItem key={action.label} disabled={action.disabled}>
										{action.label}
									</PostActionItem>
								))}
							</PostActions>
						</ChatBubbleFooter>
					) : null}
				</ChatBubbleContent>
			</ChatBubble>
		</div>
	);
}
