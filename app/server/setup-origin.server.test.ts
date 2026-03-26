import assert from "node:assert/strict";
import test from "node:test";

import { setRuntimeEnv } from "./env.server.ts";
import { resolveSetupAppOrigin } from "./setup-origin.server.ts";

test.afterEach(() => {
	setRuntimeEnv({});
});

test("uses submitted appOrigin when valid", () => {
	const formData = new FormData();
	formData.set("appOrigin", "https://gather.example.com");
	const request = new Request("http://127.0.0.1/setup", {
		method: "POST",
	});

	assert.equal(
		resolveSetupAppOrigin(request, formData),
		"https://gather.example.com",
	);
});

test("falls back to server origin when appOrigin is empty or invalid", () => {
	setRuntimeEnv({ APP_BASE_URL: "https://trusted.example.com" });
	const formData = new FormData();
	formData.set("appOrigin", "   ");
	const request = new Request("https://trusted.example.com/setup", {
		method: "POST",
	});

	assert.equal(
		resolveSetupAppOrigin(request, formData),
		"https://trusted.example.com",
	);
});

test("falls back when appOrigin is not a valid http(s) URL", () => {
	setRuntimeEnv({ APP_BASE_URL: "https://trusted.example.com" });
	const formData = new FormData();
	formData.set("appOrigin", "not-a-url");
	const request = new Request("https://trusted.example.com/setup", {
		method: "POST",
	});

	assert.equal(
		resolveSetupAppOrigin(request, formData),
		"https://trusted.example.com",
	);
});
