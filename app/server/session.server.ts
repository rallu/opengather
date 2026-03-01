import { getBetterAuth } from "./auth.server";

export function parseCookieHeader(params: {
	cookieHeader: string | null;
}): Record<string, string> {
	const header = params.cookieHeader;
	if (!header) {
		return {};
	}

	const parsed: Record<string, string> = {};
	for (const pair of header.split(";")) {
		const [rawKey, ...rest] = pair.trim().split("=");
		if (!rawKey) {
			continue;
		}
		parsed[rawKey] = decodeURIComponent(rest.join("="));
	}
	return parsed;
}

export async function getAuthUserFromRequest(params: {
	request: Request;
}): Promise<{
	id: string;
	name: string;
	email: string;
} | null> {
	try {
		const auth = getBetterAuth();
		const session = await auth.api.getSession({
			headers: params.request.headers,
		});
		if (!session?.user?.id) {
			return null;
		}
		return {
			id: session.user.id,
			name: session.user.name,
			email: session.user.email,
		};
	} catch {
		return null;
	}
}
