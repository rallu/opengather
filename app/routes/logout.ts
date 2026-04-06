import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { ensureAppBaseUrlReady } from "~/server/app-base-url-bootstrap.server";
import { getBetterAuth } from "~/server/auth.server";

function normalizeNextPath(raw: string | null): string {
	if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
		return "/feed";
	}

	return raw;
}

async function handleLogout(request: Request): Promise<Response> {
	await ensureAppBaseUrlReady();
	const requestUrl = new URL(request.url);
	const auth = getBetterAuth();
	const signOutRequest = new Request(
		new URL("/api/auth/sign-out", requestUrl.origin),
		{
			method: "POST",
			headers: new Headers({
				cookie: request.headers.get("cookie") ?? "",
				"content-type": "application/json",
			}),
			body: "{}",
		},
	);
	const signOutResponse = await auth.handler(signOutRequest);
	const headers = new Headers({
		Location: normalizeNextPath(requestUrl.searchParams.get("next")),
	});
	const getSetCookie = (
		signOutResponse.headers as Headers & {
			getSetCookie?: () => string[];
		}
	).getSetCookie;
	const cookies =
		typeof getSetCookie === "function"
			? getSetCookie.call(signOutResponse.headers)
			: [];
	if (cookies.length > 0) {
		for (const cookie of cookies) {
			headers.append("Set-Cookie", cookie);
		}
	} else {
		for (const [key, value] of signOutResponse.headers.entries()) {
			if (key.toLowerCase() === "set-cookie") {
				headers.append("Set-Cookie", value);
			}
		}
	}

	return new Response(null, {
		status: 302,
		headers,
	});
}

export async function action({ request }: ActionFunctionArgs) {
	return handleLogout(request);
}

export async function loader({ request }: LoaderFunctionArgs) {
	return handleLogout(request);
}
