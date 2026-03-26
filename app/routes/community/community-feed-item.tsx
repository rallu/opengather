import { PostFeedItem } from "~/components/post/post-feed-item";
import type { PostListItem } from "~/server/post-list.service.server";

export function CommunityFeedItem(params: {
	post: PostListItem;
	isAdmin: boolean;
	canInlineReply?: boolean;
}) {
	return <PostFeedItem {...params} />;
}
