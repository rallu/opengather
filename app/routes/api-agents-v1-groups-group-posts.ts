import type { ActionFunctionArgs } from "react-router";
import { createAgentGroupPost } from "./api-agents-v1-groups-group-posts.server.ts";

export async function action({
	request,
	params,
}: ActionFunctionArgs): Promise<Response> {
	return createAgentGroupPost({
		request,
		groupId: params.groupId ?? "",
	});
}
