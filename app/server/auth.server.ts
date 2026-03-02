import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { getDb } from "./db.server";
import { getServerEnv, hasDatabaseConfig } from "./env.server";

function createBetterAuth() {
	const env = getServerEnv();

	return betterAuth({
		database: prismaAdapter(getDb(), {
			provider: "postgresql",
		}),
		baseURL: env.BETTER_AUTH_URL,
		trustedOrigins: [
			env.BETTER_AUTH_URL,
			"http://localhost:5173",
			"http://127.0.0.1:5173",
		],
		secret: env.BETTER_AUTH_SECRET,
		...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
			? {
					socialProviders: {
						google: {
							clientId: env.GOOGLE_CLIENT_ID,
							clientSecret: env.GOOGLE_CLIENT_SECRET,
						},
					},
				}
			: {}),
		...(env.HUB_CLIENT_ID && env.HUB_CLIENT_SECRET
			? {
					plugins: [
						genericOAuth({
							config: [
								{
									providerId: "hub",
									discoveryUrl: env.HUB_OIDC_DISCOVERY_URL,
									clientId: env.HUB_CLIENT_ID,
									clientSecret: env.HUB_CLIENT_SECRET,
									scopes: ["openid", "profile", "email", "offline_access"],
									redirectURI: `${env.BETTER_AUTH_URL}/api/auth/oauth2/callback/hub`,
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

type BetterAuthInstance = ReturnType<typeof createBetterAuth>;

let authSingleton: BetterAuthInstance | null = null;

export function getBetterAuth(): BetterAuthInstance {
	if (authSingleton) {
		return authSingleton;
	}

	if (!hasDatabaseConfig()) {
		throw new Error("DATABASE_URL is not configured");
	}

	authSingleton = createBetterAuth();

	return authSingleton;
}

export const auth = hasDatabaseConfig() ? getBetterAuth() : null;
