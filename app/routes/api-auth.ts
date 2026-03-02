import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getBetterAuth } from "~/server/auth.server";

async function handleAuthRequest(params: {
	request: Request;
}): Promise<Response> {
	try {
		const auth = await getBetterAuth();
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
