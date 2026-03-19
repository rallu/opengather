import assert from "node:assert/strict";
import test from "node:test";

import {
	buildHubOidcDiscoveryUrl,
	deriveHubBaseUrlFromDiscoveryUrl,
	hasHubBaseUrl,
	isHubUiEnabled,
	normalizeHubBaseUrl,
	resolveHubBaseUrl,
} from "./hub-config.server.ts";

test("normalizeHubBaseUrl trims whitespace and trailing slashes", () => {
	assert.equal(
		normalizeHubBaseUrl(" https://hub.example.com/ "),
		"https://hub.example.com",
	);
	assert.equal(normalizeHubBaseUrl(""), "");
	assert.equal(normalizeHubBaseUrl(undefined), "");
});

test("hasHubBaseUrl returns false for empty input", () => {
	assert.equal(hasHubBaseUrl(""), false);
	assert.equal(hasHubBaseUrl("   "), false);
	assert.equal(hasHubBaseUrl("https://hub.example.com"), true);
});

test("buildHubOidcDiscoveryUrl returns empty string without a base URL", () => {
	assert.equal(buildHubOidcDiscoveryUrl(""), "");
	assert.equal(
		buildHubOidcDiscoveryUrl("https://hub.example.com/"),
		"https://hub.example.com/api/auth/.well-known/openid-configuration",
	);
});

test("resolveHubBaseUrl prefers env and falls back to discovery URL", () => {
	assert.equal(
		resolveHubBaseUrl({
			envBaseUrl: "https://hub-from-env.example.com/",
			discoveryUrl:
				"https://hub-from-config.example.com/api/auth/.well-known/openid-configuration",
		}),
		"https://hub-from-env.example.com",
	);
	assert.equal(
		resolveHubBaseUrl({
			envBaseUrl: "",
			discoveryUrl:
				"https://hub-from-config.example.com/api/auth/.well-known/openid-configuration",
		}),
		"https://hub-from-config.example.com",
	);
});

test("deriveHubBaseUrlFromDiscoveryUrl rejects non-matching URLs", () => {
	assert.equal(
		deriveHubBaseUrlFromDiscoveryUrl(
			"https://hub.example.com/api/auth/.well-known/openid-configuration",
		),
		"https://hub.example.com",
	);
	assert.equal(
		deriveHubBaseUrlFromDiscoveryUrl("https://hub.example.com/not-discovery"),
		"",
	);
});

test("isHubUiEnabled requires env availability and stored credentials", () => {
	assert.equal(
		isHubUiEnabled({
			hubAvailable: false,
			hubEnabled: true,
			hubClientId: "client-id",
			hubClientSecret: "client-secret",
		}),
		false,
	);
	assert.equal(
		isHubUiEnabled({
			hubAvailable: true,
			hubEnabled: true,
			hubClientId: "client-id",
			hubClientSecret: "client-secret",
		}),
		true,
	);
});
