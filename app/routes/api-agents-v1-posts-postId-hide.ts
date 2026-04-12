import type { ActionFunctionArgs } from "react-router";
import { hideAgentPost } from "./api-agents-v1-posts-postId-hide.server.ts";

export async function action({
	request,
	params,
}: ActionFunctionArgs): Promise<Response> {
	return hideAgentPost({
		request,
		postId: params.postId ?? "",
	});
}
