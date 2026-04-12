import { ensureAppBaseUrlReady } from "./app-base-url-bootstrap.server.ts";
import { getBetterAuth } from "./auth.server.ts";
import { ensureHostedOwnerAdminClaim } from "./hosted-owner-claim.server.ts";
import {
	getHubIdentityForLocalUser,
	linkHubInstanceForUser,
} from "./hub.service.server.ts";
import { logError } from "./logger.server.ts";
import { ensureUserHasStoredProfileImage } from "./profile-defaults.server.ts";

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

		await ensureUserHasStoredProfileImage({
			userId: session.user.id,
			email: session.user.email,
			name: session.user.name,
		});

		const hubIdentity = await getHubIdentityForLocalUser({
			localUserId: session.user.id,
		});
		if (hubIdentity?.hubUserId) {
			try {
				await ensureHostedOwnerAdminClaim({
					localUserId: session.user.id,
					hubUserId: hubIdentity.hubUserId,
				});
				if (hubIdentity.hubAccessToken) {
					await linkHubInstanceForUser({
						hubAccessToken: hubIdentity.hubAccessToken,
						hubUserId: hubIdentity.hubUserId,
					});
				}
			} catch (error) {
				logError({
					event: "session.hub_identity_sync_failed",
					data: {
						localUserId: session.user.id,
						hubUserId: hubIdentity.hubUserId,
						error: error instanceof Error ? error.message : "unknown error",
					},
				});
			}
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
