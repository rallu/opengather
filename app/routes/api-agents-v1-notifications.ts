import type { ActionFunctionArgs } from "react-router";
import { createAgentNotification } from "./api-agents-v1-notifications.server.ts";

export async function action({
	request,
}: ActionFunctionArgs): Promise<Response> {
	return createAgentNotification({ request });
}
