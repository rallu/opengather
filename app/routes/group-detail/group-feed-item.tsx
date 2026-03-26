import { PostFeedItem } from "~/components/post/post-feed-item";
import type { PostListItem } from "~/server/post-list.service.server";

export function GroupFeedItem(params: {
	post: PostListItem;
	canInlineReply?: boolean;
}) {
	return (
		<PostFeedItem
			post={params.post}
			isAdmin={false}
			showModerationActions={false}
			showGroupLabel={false}
			testIdPrefix="group"
			canInlineReply={params.canInlineReply}
		/>
	);
}
