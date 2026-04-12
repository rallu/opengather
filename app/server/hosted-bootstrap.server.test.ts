import assert from "node:assert/strict";
import test from "node:test";

import { validateHostedBootstrapEnv } from "./hosted-bootstrap.server.ts";

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
				hubClientId: "",
				hubClientSecret: "",
				hubRedirectUri: "",
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
