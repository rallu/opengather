import assert from "node:assert/strict";
import test from "node:test";

import {
	initializeHostedBootstrapFromEnv,
	validateHostedBootstrapEnv,
} from "./hosted-bootstrap.server.ts";

test("validateHostedBootstrapEnv rejects missing required values", () => {
	assert.throws(
		() =>
			validateHostedBootstrapEnv({
				enabled: true,
				appBaseUrl: "",
				databaseUrl: "",
				authSecret: "",
				vapidPublicKey: "",
				vapidPrivateKey: "",
				serverName: "",
				serverDescription: "",
				visibilityMode: "",
				approvalMode: "",
				hubBaseUrl: "",
				hubRedirectUri: "",
				hubClientId: "",
				hubClientSecret: "",
				ownerHubUserId: "",
				breakGlassEmail: "",
				breakGlassPassword: "",
			}),
		/missing required env vars/i,
	);
});

test("validateHostedBootstrapEnv accepts a fully configured hosted bootstrap payload", () => {
	const validated = validateHostedBootstrapEnv({
		enabled: true,
		appBaseUrl: "https://garden.opengather.net",
		databaseUrl: "postgres://db.example/opengather",
		authSecret: "secret",
		vapidPublicKey: "public",
		vapidPrivateKey: "private",
		serverName: "Garden Club",
		serverDescription: "Local garden community",
		visibilityMode: "approval",
		approvalMode: "manual",
		hubBaseUrl: "https://hub.opengather.net",
		hubClientId: "client-id",
		hubClientSecret: "client-secret",
		hubRedirectUri:
			"https://garden.opengather.net/api/auth/oauth2/callback/hub",
		ownerHubUserId: "hub-user-1",
		breakGlassEmail: "admin@example.com",
		breakGlassPassword: "break-glass-password",
	});

	assert.equal(validated.enabled, true);
	assert.equal(validated.serverName, "Garden Club");
	assert.equal(validated.ownerHubUserId, "hub-user-1");
});

test("validateHostedBootstrapEnv accepts Hub bootstrap without pre-provisioned credentials", () => {
	const validated = validateHostedBootstrapEnv({
		enabled: true,
		appBaseUrl: "https://garden.opengather.net",
		databaseUrl: "postgres://db.example/opengather",
		authSecret: "secret",
		vapidPublicKey: "public",
		vapidPrivateKey: "private",
		serverName: "Garden Club",
		serverDescription: "Local garden community",
		visibilityMode: "approval",
		approvalMode: "manual",
		hubBaseUrl: "https://hub.opengather.net",
		hubClientId: "",
		hubClientSecret: "",
		hubRedirectUri:
			"https://garden.opengather.net/api/auth/oauth2/callback/hub",
		ownerHubUserId: "hub-user-1",
		breakGlassEmail: "admin@example.com",
		breakGlassPassword: "break-glass-password",
	});

	assert.equal(validated.hubClientId, "");
	assert.equal(validated.hubClientSecret, "");
});

test("initializeHostedBootstrapFromEnv self-registers with Hub when credentials are missing", async () => {
	let registered = 0;
	let initialized = 0;

	await initializeHostedBootstrapFromEnv(
		{
			enabled: true,
			appBaseUrl: "https://garden.opengather.net",
			databaseUrl: "postgres://db.example/opengather",
			authSecret: "secret",
			vapidPublicKey: "public",
			vapidPrivateKey: "private",
			serverName: "Garden Club",
			serverDescription: "Local garden community",
			visibilityMode: "approval",
			approvalMode: "manual",
			hubBaseUrl: "https://hub.opengather.net",
			hubClientId: "",
			hubClientSecret: "",
			hubRedirectUri:
				"https://garden.opengather.net/api/auth/oauth2/callback/hub",
			ownerHubUserId: "hub-user-1",
			breakGlassEmail: "admin@example.com",
			breakGlassPassword: "break-glass-password",
		},
		{
			registerInstanceWithHub: async (params) => {
				registered += 1;
				assert.equal(params.instanceName, "Garden Club");
				assert.equal(params.instanceBaseUrl, "https://garden.opengather.net");
				return {
					hubClientId: "registered-client-id",
					hubClientSecret: "registered-client-secret",
					hubOidcDiscoveryUrl:
						"https://hub.opengather.net/api/auth/.well-known/openid-configuration",
				};
			},
			initializeSetup: async (params) => {
				initialized += 1;
				assert.equal(params.hub.clientId, "registered-client-id");
				assert.equal(params.hub.clientSecret, "registered-client-secret");
				return { ok: true };
			},
		},
	);

	assert.equal(registered, 1);
	assert.equal(initialized, 1);
});
