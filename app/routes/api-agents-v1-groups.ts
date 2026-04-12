import type { LoaderFunctionArgs } from "react-router";
import { loadAgentGroups } from "./api-agents-v1-groups.server.ts";

export async function loader({
	request,
}: LoaderFunctionArgs): Promise<Response> {
	return loadAgentGroups({ request });
}
