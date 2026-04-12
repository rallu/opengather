import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { handleMcpTokenRequest } from "./mcp-token.server.ts";

export async function loader({
	request,
}: LoaderFunctionArgs): Promise<Response> {
	return handleMcpTokenRequest({ request });
}

export async function action({
	request,
}: ActionFunctionArgs): Promise<Response> {
	return handleMcpTokenRequest({ request });
}
