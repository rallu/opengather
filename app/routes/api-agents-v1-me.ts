import type { LoaderFunctionArgs } from "react-router";
import { loadAgentMe } from "./api-agents-v1-me.server.ts";

export async function loader({
	request,
}: LoaderFunctionArgs): Promise<Response> {
	return loadAgentMe({ request });
}
