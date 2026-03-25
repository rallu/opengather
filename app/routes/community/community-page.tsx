import { Form } from "react-router";
import { AppShell } from "~/components/app-shell";
import { PostAssetInput } from "~/components/post/post-asset-input";
import { PostComposer } from "~/components/post/post-composer";
import {
	PostListSortToggle,
	ThreadFeedList,
} from "~/components/post/thread-feed-list";
import { Container } from "~/components/ui/container";
import { FeedContainer } from "~/components/ui/feed-container";
import type { PostListItem } from "~/server/post-list.service.server";
import { CommunityFeedItem } from "./community-feed-item";
import type { CommunityLoaderData } from "./loader.server";

export function CommunityPage(params: {
	data: CommunityLoaderData;
	errorMessage?: string;
	loading: boolean;
	pathname: string;
	priorityPost?: PostListItem;
}) {
	const buildSortHref = (sortMode: "activity" | "newest") =>
		`${params.pathname}?sort=${sortMode}`;
	const communityAside = (
		<Container className="rounded-lg border-border/50 bg-card">
			<div className="space-y-3 p-5">
				<p className="text-sm font-medium text-foreground">Sort threads</p>
				<PostListSortToggle
					sortMode={params.data.sortMode}
					buildHref={buildSortHref}
					prefix="feed"
				/>
			</div>
		</Container>
	);

	return (
		<AppShell
			authUser={params.data.authUser}
			showServerSettings={params.data.viewerRole === "admin"}
			aside={communityAside}
		>
			{params.data.status === "not_setup" ? (
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					<span data-testid="feed-setup-error">Setup is not completed.</span>
				</div>
			) : null}

			{params.data.status === "forbidden" ? (
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Access denied.
				</div>
			) : null}

			{params.data.status === "pending_membership" ? (
				<div
					className="rounded-md border border-border bg-muted/40 p-4 text-sm"
					data-testid="feed-pending-state"
				>
					<p className="font-medium">Membership approval pending</p>
					<p className="mt-1 text-muted-foreground">
						Your account is waiting for approval before you can access this
						community feed.
					</p>
				</div>
			) : null}

			{params.errorMessage ? (
				<div
					className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
					data-testid="feed-action-error"
				>
					{params.errorMessage}
				</div>
			) : null}

			<FeedContainer className="space-y-4">
				{params.data.authUser && params.data.status === "ok" ? (
					<section>
						<Form method="post" encType="multipart/form-data">
							<input type="hidden" name="_action" value="post" />
							<input type="hidden" name="parentPostId" value="" />
							<PostComposer
								name="bodyText"
								textareaTestId="feed-composer"
								placeholder="What's worth sharing right now?"
								loading={params.loading}
								disabled={params.loading}
								submitTestId="feed-post-button"
								submitClassName="h-9 w-9 bg-primary text-primary-foreground hover:bg-primary/90"
								resetKey={params.priorityPost?.id}
								footer={
									<div className="px-1">
										<PostAssetInput
											previousAlbums={params.data.previousAlbums}
											inputTestId="feed-assets-input"
											albumInputTestId="feed-albums-input"
											videoInputTestId="feed-video-input"
											imageButtonTestId="feed-image-button"
											videoButtonTestId="feed-video-button"
											resetKey={params.priorityPost?.id}
										/>
									</div>
								}
							/>
						</Form>
					</section>
				) : null}

				<ThreadFeedList
					key={`${params.pathname}-${params.data.sortMode}`}
					initialPage={params.data.page}
					apiPath={params.data.apiPath}
					listTestId="feed-post-list"
					sentinelTestId="feed-post-list-sentinel"
					loadingTestId="feed-post-list-loading"
					priorityItem={params.priorityPost}
					emptyState={
						<p className="text-sm text-muted-foreground">No posts yet.</p>
					}
					renderItem={(post) => (
						<CommunityFeedItem
							key={post.id}
							post={post}
							isAdmin={params.data.viewerRole === "admin"}
						/>
					)}
				/>
			</FeedContainer>
		</AppShell>
	);
}
