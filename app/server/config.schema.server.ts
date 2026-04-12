import {
	canonicalizeRenderLocale,
	canonicalizeRenderTimeZone,
	DEFAULT_RENDER_INTL_CONFIG,
} from "../lib/render-intl.ts";
import { getAppEnv, getHubEnv } from "./env.server.ts";
import { buildHubOidcDiscoveryUrl } from "./hub-config.server.ts";

export type ConfigValueByKey = {
	better_auth_url: string;
	google_client_id: string;
	google_client_secret: string;
	hub_base_url: string;
	hub_enabled: boolean;
	hub_oidc_discovery_url: string;
	hub_client_id: string;
	hub_client_secret: string;
	hub_redirect_uri: string;
	hub_instance_name: string;
	hub_instance_base_url: string;
	server_name: string;
	server_description: string;
	server_visibility_mode: "public" | "registered" | "approval";
	server_approval_mode: "automatic" | "manual";
	render_locale: string;
	render_time_zone: string;
	media_storage_driver: "local" | "s3";
	media_local_root: string;
	setup_completed: boolean;
	setup_instance_id: string;
	ai_settings: {
		agentUsageEnabled: boolean;
		moderationEnabled: boolean;
	};
	error_monitoring_enabled: boolean;
	error_monitoring_webhook_url: string;
	error_monitoring_alert_webhook_url: string;
	error_monitoring_sample_rate: number;
	error_monitoring_dedupe_window_seconds: number;
	hosted_owner_hub_user_id: string;
};

export type ConfigKey = keyof ConfigValueByKey;

type ConfigDefinition<K extends ConfigKey> = {
	defaultValue: ConfigValueByKey[K];
	parse: (raw: unknown) => ConfigValueByKey[K];
};

const visibilityModes = new Set<ConfigValueByKey["server_visibility_mode"]>([
	"public",
	"registered",
	"approval",
]);

const approvalModes = new Set<ConfigValueByKey["server_approval_mode"]>([
	"automatic",
	"manual",
]);

const mediaStorageDrivers = new Set<ConfigValueByKey["media_storage_driver"]>([
	"local",
	"s3",
]);

const appEnv = getAppEnv();
const hubEnv = getHubEnv();
const defaultAppBaseUrl = appEnv.APP_BASE_URL || "http://localhost:5173";
const defaultHubOidcDiscoveryUrl = buildHubOidcDiscoveryUrl(
	hubEnv.HUB_BASE_URL,
);

function parseString(raw: unknown, fallback = ""): string {
	return typeof raw === "string" ? raw : fallback;
}

function parseBoolean(raw: unknown, fallback = false): boolean {
	return typeof raw === "boolean" ? raw : fallback;
}

function parseNumber(raw: unknown, fallback = 0): number {
	return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
}

function parseVisibilityMode(
	raw: unknown,
): ConfigValueByKey["server_visibility_mode"] {
	if (typeof raw === "string" && visibilityModes.has(raw as never)) {
		return raw as ConfigValueByKey["server_visibility_mode"];
	}
	return "public";
}

function parseApprovalMode(
	raw: unknown,
): ConfigValueByKey["server_approval_mode"] {
	if (typeof raw === "string" && approvalModes.has(raw as never)) {
		return raw as ConfigValueByKey["server_approval_mode"];
	}
	return "automatic";
}

function parseMediaStorageDriver(
	raw: unknown,
): ConfigValueByKey["media_storage_driver"] {
	if (
		typeof raw === "string" &&
		mediaStorageDrivers.has(raw as ConfigValueByKey["media_storage_driver"])
	) {
		return raw as ConfigValueByKey["media_storage_driver"];
	}
	return "local";
}

function parseAiSettings(raw: unknown): ConfigValueByKey["ai_settings"] {
	if (typeof raw !== "object" || raw === null) {
		return {
			agentUsageEnabled: false,
			moderationEnabled: true,
		};
	}

	const data = raw as Partial<ConfigValueByKey["ai_settings"]>;
	return {
		agentUsageEnabled:
			typeof data.agentUsageEnabled === "boolean"
				? data.agentUsageEnabled
				: false,
		moderationEnabled:
			typeof data.moderationEnabled === "boolean"
				? data.moderationEnabled
				: true,
	};
}

export const configDefinitions: { [K in ConfigKey]: ConfigDefinition<K> } = {
	better_auth_url: {
		defaultValue: defaultAppBaseUrl,
		parse: (raw) => parseString(raw, defaultAppBaseUrl),
	},
	google_client_id: {
		defaultValue: "",
		parse: (raw) => parseString(raw),
	},
	google_client_secret: {
		defaultValue: "",
		parse: (raw) => parseString(raw),
	},
	hub_base_url: {
		defaultValue: hubEnv.HUB_BASE_URL,
		parse: (raw) => parseString(raw, hubEnv.HUB_BASE_URL),
	},
	hub_enabled: {
		defaultValue: false,
		parse: (raw) => parseBoolean(raw, false),
	},
	hub_oidc_discovery_url: {
		defaultValue: defaultHubOidcDiscoveryUrl,
		parse: (raw) => parseString(raw, defaultHubOidcDiscoveryUrl),
	},
	hub_client_id: {
		defaultValue: "",
		parse: (raw) => parseString(raw),
	},
	hub_client_secret: {
		defaultValue: "",
		parse: (raw) => parseString(raw),
	},
	hub_redirect_uri: {
		defaultValue: `${defaultAppBaseUrl}/api/auth/oauth2/callback/hub`,
		parse: (raw) =>
			parseString(raw, `${defaultAppBaseUrl}/api/auth/oauth2/callback/hub`),
	},
	hub_instance_name: {
		defaultValue: "OpenGather Instance",
		parse: (raw) => parseString(raw, "OpenGather Instance"),
	},
	hub_instance_base_url: {
		defaultValue: defaultAppBaseUrl,
		parse: (raw) => parseString(raw, defaultAppBaseUrl),
	},
	server_name: {
		defaultValue: "OpenGather",
		parse: (raw) => parseString(raw, "OpenGather"),
	},
	server_description: {
		defaultValue: "",
		parse: (raw) => parseString(raw),
	},
	server_visibility_mode: {
		defaultValue: "public",
		parse: (raw) => parseVisibilityMode(raw),
	},
	server_approval_mode: {
		defaultValue: "automatic",
		parse: (raw) => parseApprovalMode(raw),
	},
	render_locale: {
		defaultValue: DEFAULT_RENDER_INTL_CONFIG.locale,
		parse: (raw) =>
			canonicalizeRenderLocale(raw, DEFAULT_RENDER_INTL_CONFIG.locale),
	},
	render_time_zone: {
		defaultValue: DEFAULT_RENDER_INTL_CONFIG.timeZone,
		parse: (raw) =>
			canonicalizeRenderTimeZone(raw, DEFAULT_RENDER_INTL_CONFIG.timeZone),
	},
	media_storage_driver: {
		defaultValue: "local",
		parse: (raw) => parseMediaStorageDriver(raw),
	},
	media_local_root: {
		defaultValue: appEnv.MEDIA_LOCAL_ROOT,
		parse: (raw) => parseString(raw, appEnv.MEDIA_LOCAL_ROOT),
	},
	setup_completed: {
		defaultValue: false,
		parse: (raw) => parseBoolean(raw, false),
	},
	setup_instance_id: {
		defaultValue: "",
		parse: (raw) => parseString(raw),
	},
	ai_settings: {
		defaultValue: {
			agentUsageEnabled: false,
			moderationEnabled: true,
		},
		parse: (raw) => parseAiSettings(raw),
	},
	error_monitoring_enabled: {
		defaultValue: true,
		parse: (raw) => parseBoolean(raw, true),
	},
	error_monitoring_webhook_url: {
		defaultValue: "",
		parse: (raw) => parseString(raw),
	},
	error_monitoring_alert_webhook_url: {
		defaultValue: "",
		parse: (raw) => parseString(raw),
	},
	error_monitoring_sample_rate: {
		defaultValue: 1,
		parse: (raw) => parseNumber(raw, 1),
	},
	error_monitoring_dedupe_window_seconds: {
		defaultValue: 60,
		parse: (raw) => parseNumber(raw, 60),
	},
	hosted_owner_hub_user_id: {
		defaultValue: "",
		parse: (raw) => parseString(raw),
	},
};

export function parseConfigValue<K extends ConfigKey>(
	key: K,
	rawValue: unknown,
): ConfigValueByKey[K] {
	return configDefinitions[key].parse(rawValue);
}

export function getDefaultConfigValue<K extends ConfigKey>(
	key: K,
): ConfigValueByKey[K] {
	return configDefinitions[key].defaultValue;
}
