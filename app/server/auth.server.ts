import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { getServerConfig } from "./config.service.server";
import { getDb } from "./db.server";
import { getAuthEnv, hasDatabaseConfig } from "./env.server";

function createAuth(params: {
	betterAuthUrl: string;
	google: {
		clientId: string;
		clientSecret: string;
	} | null;
	hub: {
		discoveryUrl: string;
		clientId: string;
		clientSecret: string;
	} | null;
}) {
	const env = getAuthEnv();

	return betterAuth({
		database: prismaAdapter(getDb(), {
			provider: "postgresql",
		}),
		baseURL: params.betterAuthUrl,
		trustedOrigins: [
			params.betterAuthUrl,
			"http://localhost:5173",
			"http://127.0.0.1:5173",
		],
		secret: env.BETTER_AUTH_SECRET,
		advanced: {
			cookiePrefix: "opengather",
		},
		...(params.google
			? {
					socialProviders: {
						google: {
							clientId: params.google.clientId,
							clientSecret: params.google.clientSecret,
						},
					},
				}
			: {}),
		...(params.hub
			? {
					plugins: [
						genericOAuth({
							config: [
								{
									providerId: "hub",
									discoveryUrl: params.hub.discoveryUrl,
									clientId: params.hub.clientId,
									clientSecret: params.hub.clientSecret,
									scopes: ["openid", "profile", "email", "offline_access"],
									redirectURI: `${params.betterAuthUrl}/api/auth/oauth2/callback/hub`,
									pkce: true,
								},
							],
						}),
					],
				}
			: {}),
		emailAndPassword: {
			enabled: true,
			autoSignIn: true,
		},
		session: {
			expiresIn: 60 * 60 * 24 * 7,
			updateAge: 60 * 60 * 24,
			cookieCache: {
				enabled: true,
				maxAge: 60 * 5,
			},
		},
	});
}

type BetterAuthInstance = ReturnType<typeof createAuth>;

let baseAuthSingleton: BetterAuthInstance | null = null;
let hubAuthSingleton: {
	key: string;
	auth: BetterAuthInstance;
} | null = null;

export function getBetterAuth(): BetterAuthInstance {
	if (baseAuthSingleton) {
		return baseAuthSingleton;
	}

	if (!hasDatabaseConfig()) {
		throw new Error("DATABASE_URL is not configured");
	}

	baseAuthSingleton = createAuth({
		betterAuthUrl: "http://localhost:5173",
		google: null,
		hub: null,
	});
	return baseAuthSingleton;
}

export async function getBetterAuthForHubOAuth(): Promise<BetterAuthInstance> {
	if (!hasDatabaseConfig()) {
		throw new Error("DATABASE_URL is not configured");
	}

	const config = await getServerConfig();
	const hubAuthEnabled = Boolean(
		config.hubEnabled && config.hubClientId && config.hubClientSecret,
	);
	const googleAuthEnabled = Boolean(
		config.googleClientId && config.googleClientSecret,
	);

	const key = [
		config.betterAuthUrl,
		config.googleClientId,
		config.googleClientSecret,
		config.hubOidcDiscoveryUrl,
		config.hubClientId,
		config.hubClientSecret,
		String(config.hubEnabled),
	].join("|");
	if (hubAuthSingleton && hubAuthSingleton.key === key) {
		return hubAuthSingleton.auth;
	}

	const auth = createAuth({
		betterAuthUrl: config.betterAuthUrl,
		google: googleAuthEnabled
			? {
					clientId: config.googleClientId,
					clientSecret: config.googleClientSecret,
				}
			: null,
		hub: hubAuthEnabled
			? {
					discoveryUrl: config.hubOidcDiscoveryUrl,
					clientId: config.hubClientId,
					clientSecret: config.hubClientSecret,
				}
			: null,
	});
	hubAuthSingleton = { key, auth };
	return auth;
}
