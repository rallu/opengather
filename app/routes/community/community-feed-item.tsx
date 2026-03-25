import { Form, Link } from "react-router";
import { PostActionItem, PostActions } from "~/components/post/post-actions";
import { PostAssetDisplay } from "~/components/post/post-asset-display";
import { PostContent } from "~/components/post/post-content";
import { PostHeader } from "~/components/post/post-header";
import { Button } from "~/components/ui/button";
import { Container } from "~/components/ui/container";
import type { PostListItem } from "~/server/post-list.service.server";

function getDiscussionLabel(replyCount: number) {
	if (replyCount === 0) {
		return "Start discussion";
	}
	return replyCount === 1 ? "1 comment" : `${replyCount} comments`;
}

export function CommunityFeedItem(params: {
	post: PostListItem;
	isAdmin: boolean;
}) {
	const postRoute = `/posts/${params.post.id}`;

	return (
		<div
			className="space-y-3"
			data-testid={`feed-post-${params.post.id}`}
			data-thread-depth={params.post.threadDepth}
		>
			<Container
				id={`post-${params.post.id}`}
				className="rounded-lg border-border/50 bg-card p-4 transition-colors hover:border-primary/12 sm:p-5"
			>
				<Link
					to={postRoute}
					className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
					data-testid={`feed-thread-link-${params.post.id}`}
				>
					{params.post.group ? (
						<div className="mb-4 text-sm text-muted-foreground">
							<span className="font-medium text-foreground">
								{params.post.group.name}
							</span>
						</div>
					) : null}
					<PostHeader
						authorName={params.post.author.name}
						authorImageSrc={params.post.author.imageSrc}
						createdAt={params.post.createdAt}
						moderationStatus={params.post.moderationStatus}
						isHidden={params.post.isHidden}
						isDeleted={params.post.isDeleted}
					/>
					<PostContent className="mt-4 space-y-4">
						<p className="text-[15px] leading-8">{params.post.bodyText}</p>
						<PostAssetDisplay
							assets={params.post.assets}
							playableVideo={false}
						/>
					</PostContent>
				</Link>
				<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
					<PostActions className="gap-2">
						<PostActionItem
							asChild
							data-testid={`feed-comment-action-${params.post.id}`}
						>
							<Link to={postRoute}>
								{getDiscussionLabel(params.post.commentCount)}
							</Link>
						</PostActionItem>
					</PostActions>

					{params.isAdmin ? (
						<div className="flex flex-wrap items-center gap-2">
							<Form method="post">
								<input type="hidden" name="_action" value="moderate" />
								<input type="hidden" name="postId" value={params.post.id} />
								<input type="hidden" name="status" value="approved" />
								<Button type="submit" variant="outline" className="rounded-full">
									Approve
								</Button>
							</Form>
							<Form method="post">
								<input type="hidden" name="_action" value="moderate" />
								<input type="hidden" name="postId" value={params.post.id} />
								<input type="hidden" name="status" value="rejected" />
								<Button type="submit" variant="outline" className="rounded-full">
									Hide
								</Button>
							</Form>
							<Form method="post">
								<input type="hidden" name="_action" value="delete" />
								<input type="hidden" name="postId" value={params.post.id} />
								<Button type="submit" variant="outline" className="rounded-full">
									Delete
								</Button>
							</Form>
						</div>
					) : null}
				</div>
			</Container>
		</div>
	);
}
