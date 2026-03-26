import { ensureAppBaseUrlReady } from "./app-base-url-bootstrap.server.ts";
import { getBetterAuth } from "./auth.server.ts";
import {
	getHubIdentityForLocalUser,
	linkHubInstanceForUser,
} from "./hub.service.server.ts";

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
	hubUserId?: string;
	name: string;
	email: string;
} | null> {
	try {
		await ensureAppBaseUrlReady();
		const auth = getBetterAuth();
		const session = await auth.api.getSession({
			headers: params.request.headers,
		});
		if (!session?.user?.id) {
			return null;
		}

		const hubIdentity = await getHubIdentityForLocalUser({
			localUserId: session.user.id,
		});
		if (hubIdentity?.hubAccessToken && hubIdentity.hubUserId) {
			await linkHubInstanceForUser({
				hubAccessToken: hubIdentity.hubAccessToken,
				hubUserId: hubIdentity.hubUserId,
			});
		}

		return {
			id: session.user.id,
			hubUserId: hubIdentity?.hubUserId,
			name: session.user.name,
			email: session.user.email,
		};
	} catch {
		return null;
	}
}
