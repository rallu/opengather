import type { ActionFunctionArgs } from "react-router";
import { createAgentFeedPost } from "./api-agents-v1-feed-posts.server.ts";

export async function action({
	request,
}: ActionFunctionArgs): Promise<Response> {
	return createAgentFeedPost({ request });
}
