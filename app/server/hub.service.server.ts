import { getServerConfig } from "./config.service.server.ts";
import { getDb } from "./db.server.ts";
import type { NotificationKind } from "./notification.types.server.ts";

export type HubNotificationDeliveryMode = "deliver" | "sync";

export async function createHubAuthorizeUrl(params: {
	state: string;
}): Promise<string> {
	const config = await getServerConfig();
	if (!config.hubBaseUrl) {
		throw new Error("Hub is unavailable");
	}
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
	if (!config.hubBaseUrl) {
		return;
	}
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
	type: NotificationKind;
	notificationKind?: NotificationKind;
	deliveryMode: HubNotificationDeliveryMode;
	title: string;
	body: string;
	targetUrl?: string;
}): Promise<void> {
	const config = await getServerConfig();
	if (!config.hubEnabled || !config.hubInstanceBaseUrl || !config.hubBaseUrl) {
		return;
	}

	const targetUrl = params.targetUrl
		? new URL(params.targetUrl, config.hubInstanceBaseUrl).toString()
		: undefined;

	const response = await fetch(`${config.hubBaseUrl}/api/notifications/push`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			recipientHubUserId: params.recipientHubUserId,
			type: params.type,
			notificationKind: params.notificationKind,
			deliveryMode: params.deliveryMode,
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

export async function registerInstanceWithHub(params: {
	instanceName: string;
	instanceBaseUrl: string;
	redirectUri: string;
	hubBaseUrl: string;
}): Promise<{
	hubClientId: string;
	hubClientSecret: string;
	hubOidcDiscoveryUrl: string;
}> {
	if (!params.hubBaseUrl) {
		throw new Error("HUB_BASE_URL is not configured");
	}
	const response = await fetch(`${params.hubBaseUrl}/api/instances/register`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			instanceName: params.instanceName,
			instanceBaseUrl: params.instanceBaseUrl,
			redirectUri: params.redirectUri,
		}),
	});

	if (!response.ok) {
		throw new Error(`Hub registration failed: ${response.status}`);
	}

	const body = (await response.json()) as {
		hubClientId?: string;
		hubClientSecret?: string;
		hubOidcDiscoveryUrl?: string;
	};
	if (!body.hubClientId || !body.hubClientSecret || !body.hubOidcDiscoveryUrl) {
		throw new Error("Hub registration returned incomplete credentials");
	}

	return {
		hubClientId: body.hubClientId,
		hubClientSecret: body.hubClientSecret,
		hubOidcDiscoveryUrl: body.hubOidcDiscoveryUrl,
	};
}

export async function unregisterInstanceFromHub(params: {
	instanceBaseUrl: string;
}): Promise<void> {
	const config = await getServerConfig();
	if (!config.hubBaseUrl) {
		return;
	}
	const response = await fetch(`${config.hubBaseUrl}/api/instances/unregister`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			instanceBaseUrl: params.instanceBaseUrl,
		}),
	});

	if (!response.ok && response.status !== 404) {
		throw new Error(`Hub unregister failed: ${response.status}`);
	}
}
