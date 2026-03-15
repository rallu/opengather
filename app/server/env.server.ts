export type DatabaseEnv = {
	DATABASE_URL: string;
};

export type HubEnv = {
	HUB_BASE_URL: string;
};

export type AuthEnv = {
	BETTER_AUTH_SECRET: string;
};

type RuntimeEnv = Partial<DatabaseEnv & HubEnv & AuthEnv>;

const runtimeEnvSymbol = Symbol.for("opengather.runtime.env");

type GlobalWithRuntimeEnv = typeof globalThis & {
	[runtimeEnvSymbol]?: RuntimeEnv;
};

export function setRuntimeEnv(env: RuntimeEnv): void {
	(globalThis as GlobalWithRuntimeEnv)[runtimeEnvSymbol] = env;
}

function getRuntimeEnvValue<K extends keyof RuntimeEnv>(
	key: K,
	fallback: NonNullable<RuntimeEnv[K]>,
): NonNullable<RuntimeEnv[K]> {
	const runtimeEnv = (globalThis as GlobalWithRuntimeEnv)[runtimeEnvSymbol];
	const runtimeValue = runtimeEnv?.[key];
	if (typeof runtimeValue === "string" && runtimeValue.length > 0) {
		return runtimeValue;
	}

	const processValue =
		typeof process !== "undefined" ? process.env[key] : undefined;
	if (typeof processValue === "string" && processValue.length > 0) {
		return processValue as NonNullable<RuntimeEnv[K]>;
	}

	return fallback;
}

export function getDatabaseEnv(): DatabaseEnv {
	return {
		DATABASE_URL: getRuntimeEnvValue("DATABASE_URL", ""),
	};
}

export function getHubEnv(): HubEnv {
	return {
		HUB_BASE_URL: getRuntimeEnvValue("HUB_BASE_URL", "http://localhost:9000"),
	};
}

export function getAuthEnv(): AuthEnv {
	return {
		BETTER_AUTH_SECRET: getRuntimeEnvValue(
			"BETTER_AUTH_SECRET",
			"opengather-dev-secret",
		),
	};
}

export function hasDatabaseConfig(): boolean {
	return Boolean(getDatabaseEnv().DATABASE_URL);
}
