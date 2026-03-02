import "dotenv/config";

export type DatabaseEnv = {
	DATABASE_URL: string;
};

export type HubEnv = {
	HUB_BASE_URL: string;
};

export type AuthEnv = {
	BETTER_AUTH_SECRET: string;
};

export function getDatabaseEnv(): DatabaseEnv {
	return {
		DATABASE_URL: process.env.DATABASE_URL ?? "",
	};
}

export function getHubEnv(): HubEnv {
	return {
		HUB_BASE_URL: process.env.HUB_BASE_URL ?? "http://localhost:9000",
	};
}

export function getAuthEnv(): AuthEnv {
	return {
		BETTER_AUTH_SECRET:
			process.env.BETTER_AUTH_SECRET ?? "opengather-dev-secret",
	};
}

export function hasDatabaseConfig(): boolean {
	return Boolean(getDatabaseEnv().DATABASE_URL);
}
