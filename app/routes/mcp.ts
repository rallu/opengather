import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { handleAgentMcpHttpRequest } from "./mcp.server.ts";

export async function loader({
	request,
}: LoaderFunctionArgs): Promise<Response> {
	return handleAgentMcpHttpRequest({ request });
}

export async function action({
	request,
}: ActionFunctionArgs): Promise<Response> {
	return handleAgentMcpHttpRequest({ request });
}
