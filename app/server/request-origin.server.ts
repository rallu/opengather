import { getAppEnv, isSslDisabled } from "./env.server.ts";

function getFirstHeaderValue(request: Request, name: string): string | null {
	const value = request.headers.get(name);
	if (!value) {
		return null;
	}

	return (
		value
			.split(",")
			.map((item) => item.trim())
			.find(Boolean) ?? null
	);
}

function parseForwardedHeader(request: Request): {
	host: string | null;
	proto: string | null;
} {
	const forwarded = request.headers.get("forwarded");
	if (!forwarded) {
		return { host: null, proto: null };
	}

	const firstEntry = forwarded.split(",")[0]?.trim() ?? "";
	if (!firstEntry) {
		return { host: null, proto: null };
	}

	let host: string | null = null;
	let proto: string | null = null;
	for (const part of firstEntry.split(";")) {
		const [rawKey, rawValue] = part.split("=", 2);
		if (!rawKey || !rawValue) {
			continue;
		}

		const key = rawKey.trim().toLowerCase();
		const value = rawValue.trim().replace(/^"|"$/g, "");
		if (key === "host" && value) {
			host = value;
		}
		if (key === "proto" && value) {
			proto = value;
		}
	}

	return { host, proto };
}

function isLocalHostname(hostname: string): boolean {
	return (
		hostname === "localhost" ||
		hostname === "127.0.0.1" ||
		hostname === "::1" ||
		hostname.endsWith(".local")
	);
}

export function getPublicOrigin(request: Request): string {
	const appEnv = getAppEnv();
	if (appEnv.APP_BASE_URL) {
		return appEnv.APP_BASE_URL.replace(/\/+$/, "");
	}

	const requestUrl = new URL(request.url);
	const forwarded = parseForwardedHeader(request);
	const host =
		forwarded.host ??
		getFirstHeaderValue(request, "x-forwarded-host") ??
		requestUrl.host;
	const proto =
		forwarded.proto ??
		getFirstHeaderValue(request, "x-forwarded-proto") ??
		(requestUrl.protocol === "https:"
			? "https"
			: !isSslDisabled() && !isLocalHostname(requestUrl.hostname)
				? "https"
				: "http");

	return `${proto}://${host}`;
}
