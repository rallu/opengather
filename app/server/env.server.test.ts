import assert from "node:assert/strict";
import test from "node:test";

import {
	getHubEnv,
	hasHubBaseUrlConfigured,
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
