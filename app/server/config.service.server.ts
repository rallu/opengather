import type { Prisma } from "@prisma/client";
import {
	type ConfigKey,
	type ConfigValueByKey,
	configDefinitions,
	getDefaultConfigValue,
	parseConfigValue,
} from "./config.schema.server.ts";
import { getDb } from "./db.server.ts";
import { getHubEnv } from "./env.server.ts";

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
	hubEnabled: boolean;
	hubBaseUrl: string;
	hubOidcDiscoveryUrl: string;
	hubClientId: string;
	hubClientSecret: string;
	hubRedirectUri: string;
	hubInstanceName: string;
	hubInstanceBaseUrl: string;
	mediaStorageDriver: "local";
	mediaLocalRoot: string;
}> {
	const [
		betterAuthUrl,
		googleClientId,
		googleClientSecret,
		hubEnabled,
		hubOidcDiscoveryUrl,
		hubClientId,
		hubClientSecret,
		hubRedirectUri,
		hubInstanceName,
		hubInstanceBaseUrl,
		mediaStorageDriver,
		mediaLocalRoot,
	] = await Promise.all([
		getConfig("better_auth_url"),
		getConfig("google_client_id"),
		getConfig("google_client_secret"),
		getConfig("hub_enabled"),
		getConfig("hub_oidc_discovery_url"),
		getConfig("hub_client_id"),
		getConfig("hub_client_secret"),
		getConfig("hub_redirect_uri"),
		getConfig("hub_instance_name"),
		getConfig("hub_instance_base_url"),
		getConfig("media_storage_driver"),
		getConfig("media_local_root"),
	]);

	const hubEnv = getHubEnv();

	return {
		betterAuthUrl,
		googleClientId,
		googleClientSecret,
		hubEnabled,
		hubBaseUrl: hubEnv.HUB_BASE_URL,
		hubOidcDiscoveryUrl,
		hubClientId,
		hubClientSecret,
		hubRedirectUri,
		hubInstanceName,
		hubInstanceBaseUrl,
		mediaStorageDriver,
		mediaLocalRoot,
	};
}
