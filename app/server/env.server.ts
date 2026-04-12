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
	MEDIA_S3_ACCESS_KEY_ID: string;
	MEDIA_S3_BUCKET: string;
	MEDIA_S3_ENDPOINT: string;
	MEDIA_S3_FORCE_PATH_STYLE: string;
	MEDIA_S3_REGION: string;
	MEDIA_S3_SECRET_ACCESS_KEY: string;
	OPENGATHER_BOOTSTRAP: string;
	OPENGATHER_BREAK_GLASS_EMAIL: string;
	OPENGATHER_BREAK_GLASS_PASSWORD: string;
	OPENGATHER_OWNER_HUB_USER_ID: string;
	OPENGATHER_SERVER_DESCRIPTION: string;
	OPENGATHER_SERVER_NAME: string;
	OPENGATHER_VISIBILITY_MODE: string;
	OPENGATHER_APPROVAL_MODE: string;
	HUB_CLIENT_ID: string;
	HUB_CLIENT_SECRET: string;
	HUB_REDIRECT_URI: string;
	SECRET_KEY_BASE: string;
	STORAGE_ROOT: string;
};

export type HostedBootstrapEnv = {
	enabled: boolean;
	appBaseUrl: string;
	databaseUrl: string;
	authSecret: string;
	vapidPublicKey: string;
	vapidPrivateKey: string;
	serverName: string;
	serverDescription: string;
	visibilityMode: string;
	approvalMode: string;
	hubBaseUrl: string;
	hubClientId: string;
	hubClientSecret: string;
	hubRedirectUri: string;
	ownerHubUserId: string;
	breakGlassEmail: string;
	breakGlassPassword: string;
};

export type MediaS3Env = {
	accessKeyId: string;
	bucket: string;
	endpoint: string;
	forcePathStyle: boolean;
	region: string;
	secretAccessKey: string;
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
	if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
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
		MEDIA_S3_ACCESS_KEY_ID: getRuntimeEnvValue("MEDIA_S3_ACCESS_KEY_ID", ""),
		MEDIA_S3_BUCKET: getRuntimeEnvValue("MEDIA_S3_BUCKET", ""),
		MEDIA_S3_ENDPOINT: getRuntimeEnvValue("MEDIA_S3_ENDPOINT", ""),
		MEDIA_S3_FORCE_PATH_STYLE: getRuntimeEnvValue(
			"MEDIA_S3_FORCE_PATH_STYLE",
			"",
		),
		MEDIA_S3_REGION: getRuntimeEnvValue("MEDIA_S3_REGION", ""),
		MEDIA_S3_SECRET_ACCESS_KEY: getRuntimeEnvValue(
			"MEDIA_S3_SECRET_ACCESS_KEY",
			"",
		),
		OPENGATHER_BOOTSTRAP: getRuntimeEnvValue("OPENGATHER_BOOTSTRAP", ""),
		OPENGATHER_BREAK_GLASS_EMAIL: getRuntimeEnvValue(
			"OPENGATHER_BREAK_GLASS_EMAIL",
			"",
		),
		OPENGATHER_BREAK_GLASS_PASSWORD: getRuntimeEnvValue(
			"OPENGATHER_BREAK_GLASS_PASSWORD",
			"",
		),
		OPENGATHER_OWNER_HUB_USER_ID: getRuntimeEnvValue(
			"OPENGATHER_OWNER_HUB_USER_ID",
			"",
		),
		OPENGATHER_SERVER_DESCRIPTION: getRuntimeEnvValue(
			"OPENGATHER_SERVER_DESCRIPTION",
			"",
		),
		OPENGATHER_SERVER_NAME: getRuntimeEnvValue("OPENGATHER_SERVER_NAME", ""),
		OPENGATHER_VISIBILITY_MODE: getRuntimeEnvValue(
			"OPENGATHER_VISIBILITY_MODE",
			"",
		),
		OPENGATHER_APPROVAL_MODE: getRuntimeEnvValue(
			"OPENGATHER_APPROVAL_MODE",
			"",
		),
		HUB_CLIENT_ID: getRuntimeEnvValue("HUB_CLIENT_ID", ""),
		HUB_CLIENT_SECRET: getRuntimeEnvValue("HUB_CLIENT_SECRET", ""),
		HUB_REDIRECT_URI: getRuntimeEnvValue("HUB_REDIRECT_URI", ""),
		SECRET_KEY_BASE: getRuntimeEnvValue("SECRET_KEY_BASE", ""),
		STORAGE_ROOT: storageRoot || "./storage",
	};
}

export function getMediaS3Env(): MediaS3Env {
	const appEnv = getAppEnv();
	const forcePathStyle = appEnv.MEDIA_S3_FORCE_PATH_STYLE.trim().toLowerCase();

	return {
		accessKeyId: appEnv.MEDIA_S3_ACCESS_KEY_ID.trim(),
		bucket: appEnv.MEDIA_S3_BUCKET.trim(),
		endpoint: appEnv.MEDIA_S3_ENDPOINT.trim(),
		forcePathStyle:
			forcePathStyle === "1" ||
			forcePathStyle === "true" ||
			forcePathStyle === "yes",
		region: appEnv.MEDIA_S3_REGION.trim(),
		secretAccessKey: appEnv.MEDIA_S3_SECRET_ACCESS_KEY.trim(),
	};
}

export function hasMediaS3Config(): boolean {
	const env = getMediaS3Env();
	return Boolean(
		env.bucket &&
			env.region &&
			env.endpoint &&
			env.accessKeyId &&
			env.secretAccessKey,
	);
}

export function isSslDisabled(): boolean {
	const value = getAppEnv().DISABLE_SSL.trim().toLowerCase();
	return value === "1" || value === "true" || value === "yes";
}

export function isHostedBootstrapEnabled(): boolean {
	const value = getAppEnv().OPENGATHER_BOOTSTRAP.trim().toLowerCase();
	return value === "1" || value === "true" || value === "yes";
}

export function getHostedBootstrapEnv(): HostedBootstrapEnv {
	const appEnv = getAppEnv();
	const databaseEnv = getDatabaseEnv();
	const authEnv = getAuthEnv();
	const pushEnv = getPushEnv();
	const hubEnv = getHubEnv();

	return {
		enabled: isHostedBootstrapEnabled(),
		appBaseUrl: appEnv.APP_BASE_URL.trim(),
		databaseUrl: databaseEnv.DATABASE_URL.trim(),
		authSecret: authEnv.BETTER_AUTH_SECRET.trim(),
		vapidPublicKey: pushEnv.VAPID_PUBLIC_KEY.trim(),
		vapidPrivateKey: pushEnv.VAPID_PRIVATE_KEY.trim(),
		serverName: appEnv.OPENGATHER_SERVER_NAME.trim(),
		serverDescription: appEnv.OPENGATHER_SERVER_DESCRIPTION.trim(),
		visibilityMode: appEnv.OPENGATHER_VISIBILITY_MODE.trim(),
		approvalMode: appEnv.OPENGATHER_APPROVAL_MODE.trim(),
		hubBaseUrl: hubEnv.HUB_BASE_URL.trim(),
		hubClientId: appEnv.HUB_CLIENT_ID.trim(),
		hubClientSecret: appEnv.HUB_CLIENT_SECRET.trim(),
		hubRedirectUri: appEnv.HUB_REDIRECT_URI.trim(),
		ownerHubUserId: appEnv.OPENGATHER_OWNER_HUB_USER_ID.trim(),
		breakGlassEmail: appEnv.OPENGATHER_BREAK_GLASS_EMAIL.trim().toLowerCase(),
		breakGlassPassword: appEnv.OPENGATHER_BREAK_GLASS_PASSWORD,
	};
}
