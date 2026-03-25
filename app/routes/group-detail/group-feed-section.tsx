import { Form } from "react-router";
import { PostAssetInput } from "~/components/post/post-asset-input";
import { PostComposer } from "~/components/post/post-composer";
import {
	PostListSortToggle,
	ThreadFeedList,
} from "~/components/post/thread-feed-list";
import { FeedContainer } from "~/components/ui/feed-container";
import type { PostListItem } from "~/server/post-list.service.server";
import { GroupFeedItem } from "./group-feed-item";
import type { GroupDetailOkData } from "./loader.server";

export function GroupFeedSection(params: {
	data: GroupDetailOkData;
	loading: boolean;
	pathname: string;
	priorityPost?: PostListItem;
}) {
	const buildSortHref = (sortMode: "activity" | "newest") =>
		`${params.pathname}?sort=${sortMode}`;

	return (
		<FeedContainer>
			{params.data.canPost ? (
				<Form method="post" encType="multipart/form-data">
					<input type="hidden" name="_action" value="post" />
					<PostComposer
						name="bodyText"
						rows={4}
						textareaTestId="group-post-body"
						placeholder="Share something with the group"
						loading={params.loading}
						disabled={params.loading}
						submitTestId="group-post-submit"
						resetKey={params.priorityPost?.id}
						footer={
							<PostAssetInput
								previousAlbums={params.data.previousAlbums}
								inputTestId="group-assets-input"
								albumInputTestId="group-albums-input"
								videoInputTestId="group-video-input"
								imageButtonTestId="group-image-button"
								videoButtonTestId="group-video-button"
								resetKey={params.priorityPost?.id}
							/>
						}
					/>
				</Form>
			) : null}

			<div className="mb-4 flex justify-end">
				<PostListSortToggle
					sortMode={params.data.sortMode}
					buildHref={buildSortHref}
					prefix="group"
				/>
			</div>
			<ThreadFeedList
				key={`${params.pathname}-${params.data.sortMode}`}
				initialPage={params.data.page}
				apiPath={params.data.apiPath}
				listTestId="group-post-list"
				sentinelTestId="group-post-list-sentinel"
				loadingTestId="group-post-list-loading"
				priorityItem={params.priorityPost}
				emptyState={
					<div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
						No posts in this group yet.
					</div>
				}
				renderItem={(post) => <GroupFeedItem key={post.id} post={post} />}
			/>
		</FeedContainer>
	);
}
