import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { getServerConfig } from "./config.service.server";
import { getDb } from "./db.server";
import { hasDatabaseConfig } from "./env.server";

async function createBetterAuth() {
	const config = await getServerConfig();
	const googleAuthEnabled = Boolean(
		config.googleClientId && config.googleClientSecret,
	);
	const hubAuthEnabled = Boolean(
		config.hubEnabled && config.hubClientId && config.hubClientSecret,
	);

	return betterAuth({
		database: prismaAdapter(getDb(), {
			provider: "postgresql",
		}),
		baseURL: config.betterAuthUrl,
		trustedOrigins: [
			config.betterAuthUrl,
			"http://localhost:5173",
			"http://127.0.0.1:5173",
		],
		secret: config.betterAuthSecret,
		advanced: {
			cookiePrefix: "opengather",
		},
		...(googleAuthEnabled
			? {
					socialProviders: {
						google: {
							clientId: config.googleClientId,
							clientSecret: config.googleClientSecret,
						},
					},
				}
			: {}),
		...(hubAuthEnabled
			? {
					plugins: [
						genericOAuth({
							config: [
								{
									providerId: "hub",
									discoveryUrl: config.hubOidcDiscoveryUrl,
									clientId: config.hubClientId,
									clientSecret: config.hubClientSecret,
									scopes: ["openid", "profile", "email", "offline_access"],
									redirectURI: `${config.betterAuthUrl}/api/auth/oauth2/callback/hub`,
									pkce: false,
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

type BetterAuthInstance = Awaited<ReturnType<typeof createBetterAuth>>;

let authSingletonPromise: Promise<BetterAuthInstance> | null = null;

export async function getBetterAuth(): Promise<BetterAuthInstance> {
	if (authSingletonPromise) {
		return authSingletonPromise;
	}

	if (!hasDatabaseConfig()) {
		throw new Error("DATABASE_URL is not configured");
	}

	authSingletonPromise = createBetterAuth().catch((error) => {
		authSingletonPromise = null;
		throw error;
	});
	return authSingletonPromise;
}
