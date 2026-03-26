import { getPublicOrigin } from "./request-origin.server.ts";

function normalizeHttpOrigin(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) {
		return null;
	}

	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return null;
		}

		return parsed.origin;
	} catch {
		return null;
	}
}

/**
 * Uses the submitted `appOrigin` when it is a valid http(s) origin; otherwise
 * falls back to the server-derived public origin.
 */
export function resolveSetupAppOrigin(
	request: Request,
	formData: FormData,
): string {
	const serverOrigin = getPublicOrigin(request);
	const clientOrigin = normalizeHttpOrigin(
		String(formData.get("appOrigin") ?? ""),
	);
	if (!clientOrigin) {
		return serverOrigin;
	}

	return clientOrigin;
}
