import { ProfileImage } from "~/components/profile/profile-image";
import {
	ChatBubble,
	ChatBubbleBody,
	ChatBubbleContent,
	ChatBubbleFooter,
	ChatBubbleHeader,
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

export type PostCommentData = {
	id: string;
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
	depth?: number;
};

export function PostComment({ comment, depth = 0 }: PostCommentProps) {
	return (
		<div
			data-testid={`post-comment-${comment.id}`}
			style={{
				marginLeft: depth > 0 ? `${Math.min(depth, 3) * 1.25}rem` : undefined,
			}}
		>
			<ChatBubble>
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
				<ChatBubbleContent>
					<ChatBubbleHeader>
						<ChatBubbleTitle>{comment.author}</ChatBubbleTitle>
						<ChatBubbleMeta>
							{new Date(comment.createdAt).toLocaleString()}
						</ChatBubbleMeta>
					</ChatBubbleHeader>
					<ChatBubbleBody>
						<PostContent
							body={comment.body}
							moderationStatus={comment.moderationStatus}
							isHidden={comment.isHidden}
							isDeleted={comment.isDeleted}
						/>
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
