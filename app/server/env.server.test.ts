import assert from "node:assert/strict";
import test from "node:test";

import {
	getHostedBootstrapEnv,
	getHubEnv,
	getPushEnv,
	hasHubBaseUrlConfigured,
	isHostedBootstrapEnabled,
	hasPushConfig,
	setRuntimeEnv,
} from "./env.server.ts";

test.afterEach(() => {
	setRuntimeEnv({});
});

test("getHubEnv returns an empty HUB_BASE_URL when the env var is missing", () => {
	setRuntimeEnv({});

	assert.deepEqual(getHubEnv(), {
		HUB_BASE_URL: "",
	});
	assert.equal(hasHubBaseUrlConfigured(), false);
});

test("getHubEnv defaults to opengather.net in production when missing", () => {
	const previousNodeEnv = process.env.NODE_ENV;
	process.env.NODE_ENV = "production";
	setRuntimeEnv({});

	try {
		assert.deepEqual(getHubEnv(), {
			HUB_BASE_URL: "https://opengather.net",
		});
		assert.equal(hasHubBaseUrlConfigured(), true);
	} finally {
		if (previousNodeEnv === undefined) {
			delete process.env.NODE_ENV;
		} else {
			process.env.NODE_ENV = previousNodeEnv;
		}
	}
});

test("getHubEnv normalizes HUB_BASE_URL when configured", () => {
	setRuntimeEnv({
		HUB_BASE_URL: "https://hub.example.com/",
	});

	assert.deepEqual(getHubEnv(), {
		HUB_BASE_URL: "https://hub.example.com",
	});
	assert.equal(hasHubBaseUrlConfigured(), true);
});

test("getPushEnv falls back to APP_BASE_URL for the VAPID subject", () => {
	setRuntimeEnv({
		APP_BASE_URL: "https://gather.example.com/",
		VAPID_PUBLIC_KEY: "public-key",
		VAPID_PRIVATE_KEY: "private-key",
	});

	assert.deepEqual(getPushEnv(), {
		VAPID_PUBLIC_KEY: "public-key",
		VAPID_PRIVATE_KEY: "private-key",
		VAPID_SUBJECT: "https://gather.example.com",
	});
	assert.equal(hasPushConfig(), true);
});

test("getPushEnv falls back to a localhost mailto subject", () => {
	setRuntimeEnv({});

	assert.deepEqual(getPushEnv(), {
		VAPID_PUBLIC_KEY: "",
		VAPID_PRIVATE_KEY: "",
		VAPID_SUBJECT: "mailto:admin@localhost",
	});
	assert.equal(hasPushConfig(), false);
});

test("getHostedBootstrapEnv reads hosted bootstrap settings from runtime env", () => {
	setRuntimeEnv({
		OPENGATHER_BOOTSTRAP: "true",
		APP_BASE_URL: "https://garden.opengather.net",
		DATABASE_URL: "postgres://db.example/opengather",
		BETTER_AUTH_SECRET: "secret-value",
		VAPID_PUBLIC_KEY: "vapid-public",
		VAPID_PRIVATE_KEY: "vapid-private",
		OPENGATHER_SERVER_NAME: "Garden Club",
		OPENGATHER_SERVER_DESCRIPTION: "Local garden community",
		OPENGATHER_VISIBILITY_MODE: "approval",
		OPENGATHER_APPROVAL_MODE: "manual",
		HUB_BASE_URL: "https://hub.opengather.net/",
		HUB_CLIENT_ID: "hub-client",
		HUB_CLIENT_SECRET: "hub-secret",
		HUB_REDIRECT_URI:
			"https://garden.opengather.net/api/auth/oauth2/callback/hub",
		OPENGATHER_OWNER_HUB_USER_ID: "hub-user-1",
		OPENGATHER_BREAK_GLASS_EMAIL: "ADMIN@EXAMPLE.COM",
		OPENGATHER_BREAK_GLASS_PASSWORD: "break-glass-password",
	});

	assert.equal(isHostedBootstrapEnabled(), true);
	assert.deepEqual(getHostedBootstrapEnv(), {
		enabled: true,
		appBaseUrl: "https://garden.opengather.net",
		databaseUrl: "postgres://db.example/opengather",
		authSecret: "secret-value",
		vapidPublicKey: "vapid-public",
		vapidPrivateKey: "vapid-private",
		serverName: "Garden Club",
		serverDescription: "Local garden community",
		visibilityMode: "approval",
		approvalMode: "manual",
		hubBaseUrl: "https://hub.opengather.net",
		hubClientId: "hub-client",
		hubClientSecret: "hub-secret",
		hubRedirectUri:
			"https://garden.opengather.net/api/auth/oauth2/callback/hub",
		ownerHubUserId: "hub-user-1",
		breakGlassEmail: "admin@example.com",
		breakGlassPassword: "break-glass-password",
	});
});
