import assert from "node:assert/strict";
import test from "node:test";

import {
	getHubEnv,
	getPushEnv,
	hasHubBaseUrlConfigured,
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
