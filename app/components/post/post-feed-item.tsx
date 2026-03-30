import * as React from "react";
import { Link, useFetcher, useNavigate, useSubmit } from "react-router";
import { Button } from "~/components/ui/button";
import { Container } from "~/components/ui/container";
import {
	Dropdown,
	DropdownContent,
	DropdownItem,
	DropdownLabel,
	DropdownSeparator,
	DropdownTrigger,
} from "~/components/ui/dropdown";
import { Icon } from "~/components/ui/icon";
import { plainTextToRichTextDocument } from "~/lib/rich-text";
import type { PostListItem } from "~/server/post-list.service.server";
import { PostAssetDisplay } from "./post-asset-display";
import { PostComposer } from "./post-composer";
import { PostContent } from "./post-content";
import { PostHeader } from "./post-header";
import { PostRichTextContent } from "./post-rich-text-content";

type InlineReplyActionData =
	| {
			ok: true;
			actionType: "post";
			createdPost: PostListItem;
	  }
	| {
			error: string;
	  };

function getCommentLabel(commentCount: number) {
	return commentCount === 1 ? "1 comment" : `${commentCount} comments`;
}

export function PostFeedItem(params: {
	post: PostListItem;
	isAdmin: boolean;
	showModerationActions?: boolean;
	canDelete?: boolean;
	showGroupLabel?: boolean;
	testIdPrefix?: string;
	canInlineReply?: boolean;
}) {
	const navigate = useNavigate();
	const submit = useSubmit();
	const replyFetcher = useFetcher<InlineReplyActionData>();
	const postRoute = `/posts/${params.post.id}`;
	const testIdPrefix = params.testIdPrefix ?? "feed";
	const showGroupLabel = params.showGroupLabel ?? Boolean(params.post.group);
	const showModerationActions = params.showModerationActions ?? params.isAdmin;
	const canDelete = params.canDelete ?? showModerationActions;
	const canInlineReply = params.canInlineReply ?? false;
	const authorProfilePath = params.post.author.profilePath;
	const [replyOpen, setReplyOpen] = React.useState(false);

	React.useEffect(() => {
		if (
			replyFetcher.data &&
			"ok" in replyFetcher.data &&
			replyFetcher.data.ok &&
			replyFetcher.data.actionType === "post"
		) {
			setReplyOpen(false);
			navigate(postRoute);
		}
	}, [navigate, postRoute, replyFetcher.data]);

	function submitPostAction(
		action: "moderate" | "delete",
		status?: "approved" | "rejected",
	) {
		submit(
			{
				_action: action,
				postId: params.post.id,
				...(status ? { status } : {}),
			},
			{ method: "post" },
		);
	}

	return (
		<div
			className="space-y-3"
			data-testid={`${testIdPrefix}-post-${params.post.id}`}
			data-thread-depth={params.post.threadDepth}
		>
			<Container
				id={`post-${params.post.id}`}
				className="overflow-hidden rounded-lg border-border/50 bg-card transition-colors hover:border-primary/12"
			>
				<div className="flex items-start justify-between gap-3 px-4 pt-3 sm:px-5 sm:pt-4">
					<Link
						to={postRoute}
						className="min-w-0 flex-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
						data-testid={`${testIdPrefix}-thread-link-${params.post.id}`}
					>
						{showGroupLabel && params.post.group ? (
							<div className="mb-3 text-sm text-muted-foreground">
								<span className="font-medium text-foreground">
									{params.post.group.name}
								</span>
							</div>
						) : null}
						<PostHeader
							author={params.post.author}
							createdAt={params.post.createdAt}
							group={params.post.group}
							moderationStatus={params.post.moderationStatus}
							isHidden={params.post.isHidden}
							isDeleted={params.post.isDeleted}
						/>
					</Link>

					<Dropdown className="shrink-0">
						<DropdownTrigger
							className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							aria-label="Open post menu"
							data-testid={`${testIdPrefix}-post-menu-trigger-${params.post.id}`}
						>
							<Icon name="ellipsis" size={18} />
						</DropdownTrigger>
						<DropdownContent
							align="end"
							data-testid={`${testIdPrefix}-post-menu-${params.post.id}`}
						>
							<DropdownLabel>Post actions</DropdownLabel>
							<DropdownItem onClick={() => navigate(postRoute)}>
								<Icon name="messageSquare" size={16} />
								Open post
							</DropdownItem>
							{authorProfilePath ? (
								<DropdownItem
									onClick={() => navigate(authorProfilePath)}
									data-testid={`${testIdPrefix}-post-profile-link-${params.post.id}`}
								>
									<Icon name="users" size={16} />
									View profile
								</DropdownItem>
							) : null}
							{showModerationActions ? (
								<>
									<DropdownSeparator />
									<DropdownItem
										onClick={() => submitPostAction("moderate", "approved")}
									>
										<Icon name="checkCircle2" size={16} />
										Approve
									</DropdownItem>
									<DropdownItem
										onClick={() => submitPostAction("moderate", "rejected")}
									>
										<Icon name="circleMinus" size={16} />
										Hide
									</DropdownItem>
								</>
							) : null}
							{canDelete ? (
								<>
									{!showModerationActions ? <DropdownSeparator /> : null}
									<DropdownItem onClick={() => submitPostAction("delete")}>
										<Icon name="x" size={16} />
										Delete
									</DropdownItem>
								</>
							) : null}
						</DropdownContent>
					</Dropdown>
				</div>

				<Link
					to={postRoute}
					className="mt-3 block rounded-xl px-4 pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 sm:px-5 sm:pb-5"
				>
					<PostContent className="space-y-4">
						<PostRichTextContent
							document={plainTextToRichTextDocument(params.post.bodyText ?? "")}
							className="text-[15px] leading-8"
						/>
						<PostAssetDisplay
							assets={params.post.assets}
							playableVideo={false}
						/>
					</PostContent>
				</Link>

				{replyOpen && canInlineReply ? (
					<div className="border-t border-border/70 px-4 py-3 sm:px-5">
						{replyFetcher.data && "error" in replyFetcher.data ? (
							<p
								className="mb-3 text-sm text-destructive"
								data-testid={`${testIdPrefix}-reply-error-${params.post.id}`}
							>
								{replyFetcher.data.error}
							</p>
						) : null}
						<replyFetcher.Form method="post">
							<input type="hidden" name="_action" value="post" />
							<input type="hidden" name="parentPostId" value={params.post.id} />
							<PostComposer
								variant="reply"
								name="bodyText"
								placeholder="Write a reply"
								rows={3}
								loading={replyFetcher.state !== "idle"}
								disabled={replyFetcher.state !== "idle"}
								submitLabel="Reply"
								textareaTestId={`${testIdPrefix}-inline-reply-body-${params.post.id}`}
								submitTestId={`${testIdPrefix}-inline-reply-submit-${params.post.id}`}
								footer={
									<button
										type="button"
										className="text-sm text-muted-foreground transition-colors hover:text-foreground"
										onClick={() => setReplyOpen(false)}
									>
										Cancel
									</button>
								}
							/>
						</replyFetcher.Form>
					</div>
				) : null}

				<div className="flex items-center justify-end gap-2 border-t border-border/70 bg-muted/40 px-4 py-2 sm:px-5">
					<Button variant="ghost" size="icon" asChild className="w-full">
						<Link
							to={postRoute}
							aria-label={getCommentLabel(params.post.commentCount)}
							title={getCommentLabel(params.post.commentCount)}
							data-testid={`${testIdPrefix}-comment-action-${params.post.id}`}
							className="flex gap-2 px-4"
						>
							<Icon name="messageSquare" size={16} />
							{getCommentLabel(params.post.commentCount)}
						</Link>
					</Button>
					{canInlineReply ? (
						<Button
							variant="ghost"
							size="icon"
							className="w-full"
							type="button"
							onClick={() => setReplyOpen((current) => !current)}
							data-testid={`${testIdPrefix}-reply-action-${params.post.id}`}
						>
							<span className="flex gap-2 px-4">
								<Icon name="reply" size={16} />
								{replyOpen ? "Cancel" : "Reply"}
							</span>
						</Button>
					) : (
						<Button variant="ghost" size="icon" asChild className="w-full">
							<Link
								to={postRoute}
								aria-label="Reply"
								title="Reply"
								data-testid={`${testIdPrefix}-reply-action-${params.post.id}`}
								className="flex gap-2 px-4"
							>
								<Icon name="reply" size={16} />
								Reply
							</Link>
						</Button>
					)}
				</div>
			</Container>
		</div>
	);
}
