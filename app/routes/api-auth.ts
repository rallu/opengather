import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getBetterAuth, getBetterAuthForHubOAuth } from "~/server/auth.server";

function requiresHubOAuthHandler(request: Request): boolean {
	const url = new URL(request.url);
	return (
		url.pathname.endsWith("/api/auth/sign-in/oauth2") ||
		url.pathname.includes("/api/auth/oauth2/")
	);
}

async function handleAuthRequest(params: {
	request: Request;
}): Promise<Response> {
	try {
		const auth = requiresHubOAuthHandler(params.request)
			? await getBetterAuthForHubOAuth()
			: getBetterAuth();
		return await auth.handler(params.request);
	} catch (_error) {
		return new Response(JSON.stringify({ error: "Auth unavailable" }), {
			status: 503,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}
}

export async function loader({ request }: LoaderFunctionArgs) {
	return handleAuthRequest({ request });
}

export async function action({ request }: ActionFunctionArgs) {
	return handleAuthRequest({ request });
}
