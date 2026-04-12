import {
	readPersistedAppBaseUrl,
	writePersistedAppBaseUrl,
} from "./app-base-url-storage.server.ts";
import { resetBetterAuthSingleton } from "./auth.server.ts";
import { getConfig } from "./config.service.server.ts";
import { hasDatabaseConfig } from "./env.server.ts";
import { ensureHostedBootstrapReady } from "./hosted-bootstrap.server.ts";
import { logError } from "./logger.server.ts";

let inFlight: Promise<void> | null = null;

/**
 * Ensures STORAGE_ROOT/app-base-url exists when the DB already has
 * `better_auth_url` (e.g. upgrades). Safe to await on every request; resolves
 * immediately once the file exists or migration has run.
 */
export function ensureAppBaseUrlReady(): Promise<void> {
	if (readPersistedAppBaseUrl()) {
		return Promise.resolve();
	}

	if (!inFlight) {
		inFlight = (async () => {
			try {
				await ensureHostedBootstrapReady();

				if (readPersistedAppBaseUrl()) {
					return;
				}

				if (!hasDatabaseConfig()) {
					return;
				}

				const fromDb = (await getConfig("better_auth_url")).replace(/\/+$/, "");
				if (!fromDb) {
					return;
				}

				writePersistedAppBaseUrl(fromDb);
				resetBetterAuthSingleton();
			} catch (error) {
				logError({
					event: "app_base_url.bootstrap_failed",
					data: {
						error: error instanceof Error ? error.message : "unknown error",
					},
				});
			}
		})().finally(() => {
			inFlight = null;
		});
	}

	return inFlight;
}
