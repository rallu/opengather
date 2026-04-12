import {
	getHostedBootstrapEnv,
	hasDatabaseConfig,
	type HostedBootstrapEnv,
} from "./env.server.ts";
import { registerInstanceWithHub } from "./hub.service.server.ts";
import { logError, logInfo } from "./logger.server.ts";
import { getSetupStatus, initializeSetup } from "./setup.service.server.ts";

type ValidHostedBootstrapEnv = HostedBootstrapEnv & {
	enabled: true;
};

let inFlight: Promise<void> | null = null;

export function validateHostedBootstrapEnv(
	env: HostedBootstrapEnv,
): ValidHostedBootstrapEnv {
	if (!env.enabled) {
		throw new Error("Hosted bootstrap is not enabled");
	}

	const requiredEntries = [
		["APP_BASE_URL", env.appBaseUrl],
		["DATABASE_URL", env.databaseUrl],
		["BETTER_AUTH_SECRET", env.authSecret],
		["VAPID_PUBLIC_KEY", env.vapidPublicKey],
		["VAPID_PRIVATE_KEY", env.vapidPrivateKey],
		["OPENGATHER_SERVER_NAME", env.serverName],
		["OPENGATHER_VISIBILITY_MODE", env.visibilityMode],
		["OPENGATHER_APPROVAL_MODE", env.approvalMode],
		["HUB_BASE_URL", env.hubBaseUrl],
		["HUB_REDIRECT_URI", env.hubRedirectUri],
		["OPENGATHER_OWNER_HUB_USER_ID", env.ownerHubUserId],
		["OPENGATHER_BREAK_GLASS_EMAIL", env.breakGlassEmail],
		["OPENGATHER_BREAK_GLASS_PASSWORD", env.breakGlassPassword],
	];

	const missing = requiredEntries
		.filter(([, value]) => !value)
		.map(([key]) => key);
	if (missing.length > 0) {
		throw new Error(
			`Hosted bootstrap is missing required env vars: ${missing.join(", ")}`,
		);
	}

	return env as ValidHostedBootstrapEnv;
}

async function resolveHostedHubRegistration(
	env: ValidHostedBootstrapEnv,
	deps?: {
		registerInstanceWithHub?: typeof registerInstanceWithHub;
	},
) {
	if (env.hubClientId && env.hubClientSecret) {
		return {
			hubClientId: env.hubClientId,
			hubClientSecret: env.hubClientSecret,
			hubOidcDiscoveryUrl: `${env.hubBaseUrl}/api/auth/.well-known/openid-configuration`,
		};
	}

	return (
		deps?.registerInstanceWithHub ?? registerInstanceWithHub
	)({
		instanceName: env.serverName,
		instanceBaseUrl: env.appBaseUrl,
		redirectUri: env.hubRedirectUri,
		hubBaseUrl: env.hubBaseUrl,
	});
}

export async function initializeHostedBootstrapFromEnv(
	env = getHostedBootstrapEnv(),
	deps?: {
		initializeSetup?: typeof initializeSetup;
		registerInstanceWithHub?: typeof registerInstanceWithHub;
	},
): Promise<void> {
	const validated = validateHostedBootstrapEnv(env);
	const hubRegistration = await resolveHostedHubRegistration(validated, {
		registerInstanceWithHub: deps?.registerInstanceWithHub,
	});

	const result = await (deps?.initializeSetup ?? initializeSetup)({
		name: validated.serverName,
		description: validated.serverDescription || undefined,
		visibilityMode:
			validated.visibilityMode === "registered" ||
			validated.visibilityMode === "approval"
				? validated.visibilityMode
				: "public",
		approvalMode:
			validated.approvalMode === "manual" ? "manual" : "automatic",
		betterAuthUrl: validated.appBaseUrl,
		adminName: "Hosted admin",
		adminEmail: validated.breakGlassEmail,
		adminPassword: validated.breakGlassPassword,
		hub: {
			baseUrl: validated.hubBaseUrl,
			enabled: true,
			oidcDiscoveryUrl: hubRegistration.hubOidcDiscoveryUrl,
			clientId: hubRegistration.hubClientId,
			clientSecret: hubRegistration.hubClientSecret,
			redirectUri: validated.hubRedirectUri,
			instanceName: validated.serverName,
			instanceBaseUrl: validated.appBaseUrl,
			ownerHubUserId: validated.ownerHubUserId,
		},
	});

	if (!result.ok) {
		throw new Error(result.error);
	}
}

export function ensureHostedBootstrapReady(): Promise<void> {
	if (!inFlight) {
		inFlight = (async () => {
			try {
				const env = getHostedBootstrapEnv();
				if (!env.enabled || !hasDatabaseConfig()) {
					return;
				}

				const setup = await getSetupStatus();
				if (setup.isSetup) {
					return;
				}

				await initializeHostedBootstrapFromEnv(env);
				logInfo({
					event: "hosted.bootstrap.completed",
					data: {
						appBaseUrl: env.appBaseUrl,
						ownerHubUserId: env.ownerHubUserId,
					},
				});
			} catch (error) {
				logError({
					event: "hosted.bootstrap.failed",
					data: {
						error: error instanceof Error ? error.message : "unknown error",
					},
				});
				throw error;
			}
		})().finally(() => {
			inFlight = null;
		});
	}

	return inFlight;
}
