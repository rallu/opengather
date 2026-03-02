import { getDb } from "./db.server";
import { getServerEnv } from "./env.server";

export function createHubAuthorizeUrl(params: { state: string }): string {
	const env = getServerEnv();
	const query = new URLSearchParams({
		client_id: env.HUB_CLIENT_ID,
		redirect_uri: `${env.BETTER_AUTH_URL}/api/auth/oauth2/callback/hub`,
		response_type: "code",
		scope: "openid profile email offline_access",
		state: params.state,
	});
	return `${env.HUB_BASE_URL}/api/auth/oauth2/authorize?${query.toString()}`;
}

export async function completeHubLogin(_params: {
	code: string;
}): Promise<void> {
	// Legacy route compatibility: login is handled by Better Auth generic OAuth callbacks.
	return;
}

export async function getHubIdentityForLocalUser(params: {
	localUserId: string;
}): Promise<{
	hubUserId: string;
	hubAccessToken?: string;
} | null> {
	const account = await getDb().account.findFirst({
		where: {
			userId: params.localUserId,
			providerId: "hub",
		},
		select: {
			accountId: true,
			accessToken: true,
		},
	});

	if (!account?.accountId) {
		return null;
	}

	return {
		hubUserId: account.accountId,
		hubAccessToken: account.accessToken ?? undefined,
	};
}

export async function linkHubInstanceForUser(params: {
	hubAccessToken: string;
	hubUserId: string;
}): Promise<void> {
	const env = getServerEnv();
	if (!params.hubAccessToken) {
		return;
	}

	await fetch(`${env.HUB_BASE_URL}/api/instances/link`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${params.hubAccessToken}`,
		},
		body: JSON.stringify({
			hubUserId: params.hubUserId,
			instanceName: env.HUB_INSTANCE_NAME,
			instanceBaseUrl: env.HUB_INSTANCE_BASE_URL,
		}),
	}).catch(() => undefined);
}

export async function pushHubNotification(params: {
	recipientHubUserId: string;
	type: "reply" | "mention";
	title: string;
	body: string;
	targetUrl?: string;
}): Promise<void> {
	const env = getServerEnv();
	if (!env.HUB_INSTANCE_PUSH_SECRET) {
		return;
	}

	const targetUrl = params.targetUrl
		? new URL(params.targetUrl, env.HUB_INSTANCE_BASE_URL).toString()
		: undefined;

	const response = await fetch(`${env.HUB_BASE_URL}/api/notifications/push`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Instance-Secret": env.HUB_INSTANCE_PUSH_SECRET,
		},
		body: JSON.stringify({
			recipientHubUserId: params.recipientHubUserId,
			type: params.type,
			title: params.title,
			body: params.body,
			targetUrl,
			instanceBaseUrl: env.HUB_INSTANCE_BASE_URL,
		}),
	});

	if (!response.ok) {
		throw new Error(`Failed to push notification: ${response.status}`);
	}
}
