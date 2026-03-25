import assert from "node:assert/strict";
import test from "node:test";

import { setRuntimeEnv } from "./env.server.ts";
import {
	getLoopbackOriginRedirect,
	getPublicOrigin,
} from "./request-origin.server.ts";

test.afterEach(() => {
	setRuntimeEnv({});
});

test("prefers APP_BASE_URL when configured", () => {
	setRuntimeEnv({ APP_BASE_URL: "https://gather.example.com/" });

	const request = new Request("http://127.0.0.1/setup");

	assert.equal(getPublicOrigin(request), "https://gather.example.com");
});

test("uses forwarded host and proto headers", () => {
	const request = new Request("http://127.0.0.1/setup", {
		headers: {
			"x-forwarded-host": "gather.example.com",
			"x-forwarded-proto": "https",
		},
	});

	assert.equal(getPublicOrigin(request), "https://gather.example.com");
});

test("parses RFC 7239 forwarded header", () => {
	const request = new Request("http://127.0.0.1/setup", {
		headers: {
			forwarded: 'for=203.0.113.2;proto=https;host="gather.example.com:443"',
		},
	});

	assert.equal(getPublicOrigin(request), "https://gather.example.com:443");
});

test("infers https for non-local hosts when ssl is enabled", () => {
	setRuntimeEnv({ DISABLE_SSL: "false" });

	const request = new Request("http://gather.example.com/setup");

	assert.equal(getPublicOrigin(request), "https://gather.example.com");
});

test("keeps http for local hosts", () => {
	setRuntimeEnv({ DISABLE_SSL: "false" });

	const request = new Request("http://localhost:5173/setup");

	assert.equal(getPublicOrigin(request), "http://localhost:5173");
});

test("redirects loopback requests to the configured auth origin", () => {
	const request = new Request("http://localhost:5173/login?next=%2Ffeed");

	assert.equal(
		getLoopbackOriginRedirect(request, "http://127.0.0.1:5173"),
		"http://127.0.0.1:5173/login?next=%2Ffeed",
	);
});

test("does not redirect when the loopback origin already matches", () => {
	const request = new Request("http://localhost:5173/login?next=%2Ffeed");

	assert.equal(
		getLoopbackOriginRedirect(request, "http://localhost:5173"),
		null,
	);
});

test("does not redirect when the configured port differs", () => {
	const request = new Request("http://localhost:5173/login?next=%2Ffeed");

	assert.equal(
		getLoopbackOriginRedirect(request, "http://127.0.0.1:4173"),
		null,
	);
});
