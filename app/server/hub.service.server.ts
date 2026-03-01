import { getServerEnv } from "./env.server";

export function createHubAuthorizeUrl(params: { state: string }): string {
	const env = getServerEnv();
	const query = new URLSearchParams({
		client_id: env.HUB_CLIENT_ID,
		redirect_uri: env.HUB_REDIRECT_URI,
		response_type: "code",
		scope: "openid profile email",
		state: params.state,
	});
	return `${env.HUB_BASE_URL}/oidc/authorize?${query.toString()}`;
}

export async function completeHubLogin(params: {
	code: string;
}): Promise<void> {
	const env = getServerEnv();

	const tokenResponse = await fetch(`${env.HUB_BASE_URL}/oidc/token`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			grant_type: "authorization_code",
			code: params.code,
			client_id: env.HUB_CLIENT_ID,
			client_secret: env.HUB_CLIENT_SECRET,
			redirect_uri: env.HUB_REDIRECT_URI,
		}),
	});

	if (!tokenResponse.ok) {
		throw new Error("Failed to exchange OIDC code");
	}

	const tokenBody = (await tokenResponse.json()) as { access_token: string };

	const userInfoResponse = await fetch(`${env.HUB_BASE_URL}/oidc/userinfo`, {
		headers: {
			Authorization: `Bearer ${tokenBody.access_token}`,
		},
	});

	if (!userInfoResponse.ok) {
		throw new Error("Failed to fetch user info from hub");
	}

	const userInfo = (await userInfoResponse.json()) as {
		sub: string;
		email: string;
		name: string;
		picture?: string;
	};

	await fetch(`${env.HUB_BASE_URL}/instances/link`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${tokenBody.access_token}`,
		},
		body: JSON.stringify({
			hubUserId: userInfo.sub,
			instanceName: env.HUB_INSTANCE_NAME,
			instanceBaseUrl: env.HUB_INSTANCE_BASE_URL,
		}),
	}).catch(() => undefined);

	return;
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

	const response = await fetch(`${env.HUB_BASE_URL}/notifications/push`, {
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
