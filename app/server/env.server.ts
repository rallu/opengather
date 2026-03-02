import "dotenv/config";

export type DatabaseEnv = {
	DATABASE_URL: string;
};

export function getDatabaseEnv(): DatabaseEnv {
	return {
		DATABASE_URL: process.env.DATABASE_URL ?? "",
	};
}

export function hasDatabaseConfig(): boolean {
	return Boolean(getDatabaseEnv().DATABASE_URL);
}
