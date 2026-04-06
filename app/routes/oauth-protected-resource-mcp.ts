import type { LoaderFunctionArgs } from "react-router";
import { createOauthProtectedResourceMetadataResponse } from "../server/agent-oauth-metadata.server.ts";

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
	return createOauthProtectedResourceMetadataResponse({ request });
}
