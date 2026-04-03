import type { Prisma } from "@prisma/client";
import type { RenderIntlConfig } from "../lib/render-intl.ts";
import {
	type ConfigKey,
	type ConfigValueByKey,
	configDefinitions,
	getDefaultConfigValue,
	parseConfigValue,
} from "./config.schema.server.ts";
import { getDb } from "./db.server.ts";
import { hasHubBaseUrl, resolveHubBaseUrl } from "./hub-config.server.ts";

export async function initializeConfigDefaults(): Promise<void> {
	const db = getDb();
	const existing = await db.config.findMany({ select: { key: true } });
	const existingKeys = new Set(existing.map((item) => item.key));

	const missing: Array<{ key: string; value: Prisma.InputJsonValue }> = [];
	for (const key of Object.keys(configDefinitions) as ConfigKey[]) {
		if (existingKeys.has(key)) {
			continue;
		}
		missing.push({
			key,
			value: configDefinitions[key].defaultValue as Prisma.InputJsonValue,
		});
	}

	if (missing.length > 0) {
		await db.config.createMany({ data: missing });
	}
}

export async function getConfig<K extends ConfigKey>(
	key: K,
): Promise<ConfigValueByKey[K]> {
	const row = await getDb().config.findUnique({
		where: { key },
		select: { value: true },
	});

	if (!row) {
		const defaultValue = getDefaultConfigValue(key);
		await getDb().config.upsert({
			where: { key },
			create: {
				key,
				value: defaultValue as Prisma.InputJsonValue,
			},
			update: {
				value: defaultValue as Prisma.InputJsonValue,
				updatedAt: new Date(),
			},
		});
		return defaultValue;
	}

	return parseConfigValue(key, row.value);
}

export async function setConfig<K extends ConfigKey>(
	key: K,
	value: ConfigValueByKey[K],
): Promise<ConfigValueByKey[K]> {
	const parsed = parseConfigValue(key, value);

	await getDb().config.upsert({
		where: { key },
		create: {
			key,
			value: parsed as Prisma.InputJsonValue,
		},
		update: {
			value: parsed as Prisma.InputJsonValue,
			updatedAt: new Date(),
		},
	});

	return parsed;
}

export async function hasAnyConfig(): Promise<boolean> {
	const count = await getDb().config.count();
	return count > 0;
}

export async function getServerConfig(): Promise<{
	betterAuthUrl: string;
	googleClientId: string;
	googleClientSecret: string;
	hubAvailable: boolean;
	hubEnabled: boolean;
	hubBaseUrl: string;
	hubOidcDiscoveryUrl: string;
	hubClientId: string;
	hubClientSecret: string;
	hubRedirectUri: string;
	hubInstanceName: string;
	hubInstanceBaseUrl: string;
	renderLocale: string;
	renderTimeZone: string;
	mediaStorageDriver: "local";
	mediaLocalRoot: string;
}> {
	const [
		betterAuthUrl,
		googleClientId,
		googleClientSecret,
		hubBaseUrl,
		hubEnabled,
		hubOidcDiscoveryUrl,
		hubClientId,
		hubClientSecret,
		hubRedirectUri,
		hubInstanceName,
		hubInstanceBaseUrl,
		renderLocale,
		renderTimeZone,
		mediaStorageDriver,
		mediaLocalRoot,
	] = await Promise.all([
		getConfig("better_auth_url"),
		getConfig("google_client_id"),
		getConfig("google_client_secret"),
		getConfig("hub_base_url"),
		getConfig("hub_enabled"),
		getConfig("hub_oidc_discovery_url"),
		getConfig("hub_client_id"),
		getConfig("hub_client_secret"),
		getConfig("hub_redirect_uri"),
		getConfig("hub_instance_name"),
		getConfig("hub_instance_base_url"),
		getConfig("render_locale"),
		getConfig("render_time_zone"),
		getConfig("media_storage_driver"),
		getConfig("media_local_root"),
	]);

	const resolvedHubBaseUrl = resolveHubBaseUrl({
		envBaseUrl: hubBaseUrl,
		discoveryUrl: hubOidcDiscoveryUrl,
	});
	const hubAvailable = hasHubBaseUrl(resolvedHubBaseUrl);

	return {
		betterAuthUrl,
		googleClientId,
		googleClientSecret,
		hubAvailable,
		hubEnabled,
		hubBaseUrl: resolvedHubBaseUrl,
		hubOidcDiscoveryUrl,
		hubClientId,
		hubClientSecret,
		hubRedirectUri,
		hubInstanceName,
		hubInstanceBaseUrl,
		renderLocale,
		renderTimeZone,
		mediaStorageDriver,
		mediaLocalRoot,
	};
}

export async function getRenderIntlConfig(): Promise<RenderIntlConfig> {
	const [locale, timeZone] = await Promise.all([
		getConfig("render_locale"),
		getConfig("render_time_zone"),
	]);

	return {
		locale,
		timeZone,
	};
}
