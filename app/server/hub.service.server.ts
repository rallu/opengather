import { getDb } from "./db.server";
import { getServerConfig } from "./config.service.server";

export async function createHubAuthorizeUrl(params: {
	state: string;
}): Promise<string> {
	const config = await getServerConfig();
	const query = new URLSearchParams({
		client_id: config.hubClientId,
		redirect_uri: `${config.betterAuthUrl}/api/auth/oauth2/callback/hub`,
		response_type: "code",
		scope: "openid profile email offline_access",
		state: params.state,
	});
	return `${config.hubBaseUrl}/api/auth/oauth2/authorize?${query.toString()}`;
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
	hubUserId: string;
	hubAccessToken?: string;
}): Promise<void> {
	const config = await getServerConfig();
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (params.hubAccessToken) {
		headers.Authorization = `Bearer ${params.hubAccessToken}`;
	}

	await fetch(`${config.hubBaseUrl}/api/instances/link`, {
		method: "POST",
		headers,
		body: JSON.stringify({
			hubUserId: params.hubUserId,
			instanceName: config.hubInstanceName,
			instanceBaseUrl: config.hubInstanceBaseUrl,
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
	const config = await getServerConfig();
	if (!config.hubInstancePushSecret) {
		return;
	}

	const targetUrl = params.targetUrl
		? new URL(params.targetUrl, config.hubInstanceBaseUrl).toString()
		: undefined;

	const response = await fetch(`${config.hubBaseUrl}/api/notifications/push`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Instance-Secret": config.hubInstancePushSecret,
		},
		body: JSON.stringify({
			recipientHubUserId: params.recipientHubUserId,
			type: params.type,
			title: params.title,
			body: params.body,
			targetUrl,
			instanceBaseUrl: config.hubInstanceBaseUrl,
		}),
	});

	if (!response.ok) {
		throw new Error(`Failed to push notification: ${response.status}`);
	}
}
