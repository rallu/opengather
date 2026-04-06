import type { LoaderFunctionArgs } from "react-router";
import { createOauthAuthorizationServerMetadataResponse } from "../server/agent-oauth-metadata.server.ts";

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
	return createOauthAuthorizationServerMetadataResponse({ request });
}
