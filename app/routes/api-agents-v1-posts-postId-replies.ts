import type { ActionFunctionArgs } from "react-router";
import { createAgentReply } from "./api-agents-v1-posts-postId-replies.server.ts";

export async function action({
	request,
	params,
}: ActionFunctionArgs): Promise<Response> {
	return createAgentReply({
		request,
		postId: params.postId ?? "",
	});
}
