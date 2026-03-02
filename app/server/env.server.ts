import "dotenv/config";

export type ServerEnv = {
	DATABASE_URL: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	HUB_BASE_URL: string;
	HUB_OIDC_DISCOVERY_URL: string;
	HUB_CLIENT_ID: string;
	HUB_CLIENT_SECRET: string;
	HUB_REDIRECT_URI: string;
	HUB_INSTANCE_NAME: string;
	HUB_INSTANCE_BASE_URL: string;
	HUB_INSTANCE_PUSH_SECRET: string;
};

export function getServerEnv(): ServerEnv {
	return {
		DATABASE_URL: process.env.DATABASE_URL ?? "",
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "dev-secret",
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:5173",
		GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
		GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
		HUB_BASE_URL: process.env.HUB_BASE_URL ?? "http://localhost:9000",
		HUB_OIDC_DISCOVERY_URL:
			process.env.HUB_OIDC_DISCOVERY_URL ??
			`${process.env.HUB_BASE_URL ?? "http://localhost:9000"}/api/auth/.well-known/openid-configuration`,
		HUB_CLIENT_ID: process.env.HUB_CLIENT_ID ?? "",
		HUB_CLIENT_SECRET: process.env.HUB_CLIENT_SECRET ?? "",
		HUB_REDIRECT_URI:
			process.env.HUB_REDIRECT_URI ?? "http://localhost:5173/auth/hub/callback",
		HUB_INSTANCE_NAME: process.env.HUB_INSTANCE_NAME ?? "OpenGather Instance",
		HUB_INSTANCE_BASE_URL:
			process.env.HUB_INSTANCE_BASE_URL ?? "http://localhost:5173",
		HUB_INSTANCE_PUSH_SECRET: process.env.HUB_INSTANCE_PUSH_SECRET ?? "",
	};
}

export function hasDatabaseConfig(): boolean {
	return Boolean(getServerEnv().DATABASE_URL);
}
