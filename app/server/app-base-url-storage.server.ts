import fs from "node:fs";
import path from "node:path";
import { getAppEnv } from "./env.server.ts";

const APP_BASE_URL_FILENAME = "app-base-url";

export function getPersistedAppBaseUrlFilePath(): string {
	return path.join(getAppEnv().STORAGE_ROOT, APP_BASE_URL_FILENAME);
}

function normalizeAppBaseUrlString(raw: string): string {
	const trimmed = raw.trim().replace(/\/+$/, "");
	const parsed = new URL(trimmed);
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error("Invalid app base URL protocol");
	}

	return parsed.origin;
}

/**
 * Reads the canonical app origin persisted under STORAGE_ROOT (sync).
 * Returns empty string if missing or invalid.
 */
export function readPersistedAppBaseUrl(): string {
	try {
		const raw = fs.readFileSync(getPersistedAppBaseUrlFilePath(), "utf8");
		try {
			return normalizeAppBaseUrlString(raw);
		} catch {
			return "";
		}
	} catch {
		return "";
	}
}

/**
 * Persists the canonical app origin for Better Auth and other server logic (sync).
 */
export function writePersistedAppBaseUrl(url: string): void {
	const normalized = normalizeAppBaseUrlString(url);
	const dir = getAppEnv().STORAGE_ROOT;
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(getPersistedAppBaseUrlFilePath(), `${normalized}\n`, "utf8");
}
