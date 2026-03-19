import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router";
import { ProfileImage } from "~/components/profile/profile-image";
import {
	ChatBubble,
	ChatBubbleBody,
	ChatBubbleContent,
	ChatBubbleFooter,
	ChatBubbleHeader,
	ChatBubbleHeading,
	ChatBubbleMeta,
	ChatBubbleTitle,
} from "~/components/ui/chat-bubble";
import { Icon } from "~/components/ui/icon";
import { IconButton } from "~/components/ui/icon-button";
import { cn } from "~/lib/utils";
import type { PostAssetSummary } from "~/server/post-assets.server";
import {
	type PostActionData,
	PostActionItem,
	PostActions,
} from "./post-actions";
import { PostAssetDisplay } from "./post-asset-display";
import { PostLabels } from "./post-labels";

export type PostCommentData = {
	id: string;
	threadDepth: number;
	author?: string;
	body: string;
	assets?: PostAssetSummary[];
	createdAt: string;
	imageSrc?: string;
	fallback?: string;
	moderationStatus?: "pending" | "approved" | "rejected" | "flagged";
	isHidden?: boolean;
	isDeleted?: boolean;
	actions?: PostActionData[];
	replies?: PostCommentData[];
	testId?: string;
};

type PostCommentProps = {
	comment: PostCommentData;
	children?: ReactNode;
};

export function PostComment({ comment, children }: PostCommentProps) {
	const author = comment.author?.trim() || "Member";
	const hasChildren = Boolean(children);
	const [isOpen, setIsOpen] = useState(true);
	const metaLabel = new Date(comment.createdAt).toLocaleString();

	return (
		<article
			aria-label={`Comment from ${author} ${metaLabel}`}
			className="min-w-0"
			data-testid={comment.testId ?? `post-comment-${comment.id}`}
			data-thread-depth={comment.threadDepth}
		>
			<details
				open={isOpen}
				onToggle={(event) =>
					setIsOpen((event.currentTarget as HTMLDetailsElement).open)
				}
				className="min-w-0"
			>
				<summary className="grid cursor-pointer list-none grid-cols-[32px_minmax(0,1fr)] gap-x-3 pb-0 [&::-webkit-details-marker]:hidden">
					<div className="relative">
						<ProfileImage
							src={comment.imageSrc}
							alt={author}
							fallback={comment.fallback ?? author.slice(0, 2).toUpperCase()}
							size="sm"
							className="h-8 w-8 border-background"
						/>
					</div>
					<div className="min-w-0">
						<ChatBubbleHeader className="mb-0">
							<ChatBubbleHeading>
								<ChatBubbleTitle className="flex flex-wrap items-center gap-2">
									<span>{author}</span>
									<PostLabels
										moderationStatus={comment.moderationStatus}
										isHidden={comment.isHidden}
										isDeleted={comment.isDeleted}
									/>
								</ChatBubbleTitle>
								<ChatBubbleMeta>{metaLabel}</ChatBubbleMeta>
							</ChatBubbleHeading>
						</ChatBubbleHeader>
					</div>
				</summary>
				<div className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 pt-1">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute bottom-0 left-4 top-0 flex w-px justify-center"
					>
						<div className="w-px bg-border/80" />
					</div>
					<div />
					<div className="min-w-0">
						<ChatBubble>
							<ChatBubbleContent>
								<ChatBubbleBody>
									<p>{comment.body || "(no text)"}</p>
									{comment.assets?.length ? (
										<PostAssetDisplay
											assets={comment.assets}
											className="mt-3"
										/>
									) : null}
								</ChatBubbleBody>
							</ChatBubbleContent>
						</ChatBubble>
					</div>
					<div className="relative z-10 flex justify-center bg-background pt-1">
						{hasChildren ? (
							<IconButton
								type="button"
								variant="ghost"
								label={isOpen ? "Collapse thread" : "Expand thread"}
								onClick={() => setIsOpen((current) => !current)}
								className="h-7 w-7 rounded-full border border-border/80 bg-background text-foreground hover:bg-accent"
							>
								<Icon name={isOpen ? "circleMinus" : "circlePlus"} size={16} />
							</IconButton>
						) : null}
					</div>
					<div className="min-w-0">
						{comment.actions?.length ? (
							<ChatBubbleFooter className="mt-0">
								<PostActions className="gap-x-1.5 gap-y-1">
									{comment.actions.map((action) =>
										action.to ? (
											<PostActionItem
												key={action.label}
												asChild
												data-testid={action.testId}
												className={cn(
													"h-auto rounded-md px-2 py-1 text-[13px] font-semibold hover:bg-accent/60",
													action.isActive
														? "bg-accent/70 text-foreground hover:bg-accent/70"
														: undefined,
												)}
											>
												<Link to={action.to}>{action.label}</Link>
											</PostActionItem>
										) : (
											<PostActionItem
												key={action.label}
												type="button"
												disabled={action.disabled}
												onClick={action.onClick}
												aria-pressed={action.isActive}
												data-testid={action.testId}
												className={cn(
													"h-auto rounded-md px-2 py-1 text-[13px] font-semibold hover:bg-accent/60",
													action.isActive
														? "bg-accent/70 text-foreground hover:bg-accent/70"
														: undefined,
												)}
											>
												{action.label}
											</PostActionItem>
										),
									)}
								</PostActions>
							</ChatBubbleFooter>
						) : null}
					</div>
					{hasChildren && isOpen ? (
						<>
							<div aria-hidden="true" className="threadline flex justify-end">
								<div className="mt-2 h-4 w-[calc(50%+0.5px)] rounded-bl-[12px] border-b border-l border-border/80" />
							</div>
							<div className="min-w-0 pl-2 pt-1">{children}</div>
						</>
					) : null}
				</div>
			</details>
		</article>
	);
}
