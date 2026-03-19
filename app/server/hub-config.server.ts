export function normalizeHubBaseUrl(value?: string | null): string {
	if (typeof value !== "string") {
		return "";
	}

	return value.trim().replace(/\/+$/, "");
}

export function hasHubBaseUrl(value?: string | null): boolean {
	return normalizeHubBaseUrl(value).length > 0;
}

export function buildHubOidcDiscoveryUrl(baseUrl?: string | null): string {
	const normalizedBaseUrl = normalizeHubBaseUrl(baseUrl);
	if (!normalizedBaseUrl) {
		return "";
	}

	return `${normalizedBaseUrl}/api/auth/.well-known/openid-configuration`;
}

export function deriveHubBaseUrlFromDiscoveryUrl(
	discoveryUrl?: string | null,
): string {
	if (typeof discoveryUrl !== "string" || discoveryUrl.trim().length === 0) {
		return "";
	}

	try {
		const url = new URL(discoveryUrl.trim());
		const nextPathname = url.pathname.replace(
			/\/api\/auth\/\.well-known\/openid-configuration$/,
			"",
		);

		if (nextPathname === url.pathname) {
			return "";
		}

		return `${url.origin}${nextPathname}`.replace(/\/+$/, "");
	} catch {
		return "";
	}
}

export function resolveHubBaseUrl(params: {
	envBaseUrl?: string | null;
	discoveryUrl?: string | null;
}): string {
	return (
		normalizeHubBaseUrl(params.envBaseUrl) ||
		deriveHubBaseUrlFromDiscoveryUrl(params.discoveryUrl)
	);
}

export function isHubUiEnabled(params: {
	hubAvailable: boolean;
	hubEnabled: boolean;
	hubClientId: string;
	hubClientSecret: string;
}): boolean {
	return Boolean(
		params.hubAvailable &&
			params.hubEnabled &&
			params.hubClientId &&
			params.hubClientSecret,
	);
}
