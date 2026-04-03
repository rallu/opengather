import path from "node:path";
import { hasHubBaseUrl, normalizeHubBaseUrl } from "./hub-config.server.ts";

export type DatabaseEnv = {
	DATABASE_URL: string;
};

export type HubEnv = {
	HUB_BASE_URL: string;
};

export type AuthEnv = {
	BETTER_AUTH_SECRET: string;
};

export type PushEnv = {
	VAPID_PRIVATE_KEY: string;
	VAPID_PUBLIC_KEY: string;
	VAPID_SUBJECT: string;
};

export type AppEnv = {
	APP_BASE_URL: string;
	DISABLE_SSL: string;
	MEDIA_LOCAL_ROOT: string;
	SECRET_KEY_BASE: string;
	STORAGE_ROOT: string;
};

type RuntimeEnv = Partial<DatabaseEnv & HubEnv & AuthEnv & PushEnv & AppEnv>;

const runtimeEnvSymbol = Symbol.for("opengather.runtime.env");

type GlobalWithRuntimeEnv = typeof globalThis & {
	[runtimeEnvSymbol]?: RuntimeEnv;
};

const DEFAULT_PRODUCTION_HUB_BASE_URL = "https://opengather.net";

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

function getDefaultVapidSubject(): string {
	const appBaseUrl = getRuntimeEnvValue("APP_BASE_URL", "").trim();
	if (appBaseUrl) {
		try {
			const parsed = new URL(appBaseUrl);
			if (parsed.protocol === "http:" || parsed.protocol === "https:") {
				return parsed.origin;
			}
		} catch {
			// Fall through to the mailto fallback when APP_BASE_URL is invalid.
		}
	}

	return "mailto:admin@localhost";
}

function getDefaultHubBaseUrl(): string {
	if (
		typeof process !== "undefined" &&
		process.env.NODE_ENV === "production"
	) {
		return DEFAULT_PRODUCTION_HUB_BASE_URL;
	}

	return "";
}

export function getDatabaseEnv(): DatabaseEnv {
	return {
		DATABASE_URL: getRuntimeEnvValue("DATABASE_URL", ""),
	};
}

export function getHubEnv(): HubEnv {
	return {
		HUB_BASE_URL: normalizeHubBaseUrl(
			getRuntimeEnvValue("HUB_BASE_URL", getDefaultHubBaseUrl()),
		),
	};
}

export function hasHubBaseUrlConfigured(): boolean {
	return hasHubBaseUrl(getHubEnv().HUB_BASE_URL);
}

export function getAuthEnv(): AuthEnv {
	return {
		BETTER_AUTH_SECRET:
			getRuntimeEnvValue("BETTER_AUTH_SECRET", "") ||
			getRuntimeEnvValue("SECRET_KEY_BASE", "") ||
			"opengather-dev-secret",
	};
}

export function getPushEnv(): PushEnv {
	return {
		VAPID_PRIVATE_KEY: getRuntimeEnvValue("VAPID_PRIVATE_KEY", ""),
		VAPID_PUBLIC_KEY: getRuntimeEnvValue("VAPID_PUBLIC_KEY", ""),
		VAPID_SUBJECT:
			getRuntimeEnvValue("VAPID_SUBJECT", "").trim() ||
			getDefaultVapidSubject(),
	};
}

export function hasPushConfig(): boolean {
	const env = getPushEnv();
	return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

export function hasDatabaseConfig(): boolean {
	return Boolean(getDatabaseEnv().DATABASE_URL);
}

export function getAppEnv(): AppEnv {
	const storageRoot = getRuntimeEnvValue("STORAGE_ROOT", "");
	return {
		APP_BASE_URL: getRuntimeEnvValue("APP_BASE_URL", ""),
		DISABLE_SSL: getRuntimeEnvValue("DISABLE_SSL", ""),
		MEDIA_LOCAL_ROOT:
			getRuntimeEnvValue("MEDIA_LOCAL_ROOT", "") ||
			(storageRoot ? path.posix.join(storageRoot, "media") : "./storage/media"),
		SECRET_KEY_BASE: getRuntimeEnvValue("SECRET_KEY_BASE", ""),
		STORAGE_ROOT: storageRoot || "./storage",
	};
}

export function isSslDisabled(): boolean {
	const value = getAppEnv().DISABLE_SSL.trim().toLowerCase();
	return value === "1" || value === "true" || value === "yes";
}
