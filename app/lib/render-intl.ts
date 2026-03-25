export type RenderIntlConfig = {
	locale: string;
	timeZone: string;
};

const MINUTE_IN_MS = 60 * 1000;
const HOUR_IN_MS = 60 * MINUTE_IN_MS;
const DAY_IN_MS = 24 * HOUR_IN_MS;

export const DEFAULT_RENDER_INTL_CONFIG: RenderIntlConfig = {
	locale: "en-US",
	timeZone: "UTC",
};

export function parseRenderLocale(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const candidate = value.trim();
	if (!candidate) {
		return null;
	}

	try {
		const [canonicalLocale] = Intl.getCanonicalLocales(candidate);
		return canonicalLocale ?? null;
	} catch {
		return null;
	}
}

export function parseRenderTimeZone(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const candidate = value.trim();
	if (!candidate) {
		return null;
	}

	try {
		return new Intl.DateTimeFormat(DEFAULT_RENDER_INTL_CONFIG.locale, {
			timeZone: candidate,
		}).resolvedOptions().timeZone;
	} catch {
		return null;
	}
}

export function canonicalizeRenderLocale(
	value: unknown,
	fallback = DEFAULT_RENDER_INTL_CONFIG.locale,
): string {
	return parseRenderLocale(value) ?? fallback;
}

export function canonicalizeRenderTimeZone(
	value: unknown,
	fallback = DEFAULT_RENDER_INTL_CONFIG.timeZone,
): string {
	return parseRenderTimeZone(value) ?? fallback;
}

export function formatDateTime(
	value: Date | string | number,
	renderIntl: RenderIntlConfig,
): string {
	const date = value instanceof Date ? value : new Date(value);
	return date.toLocaleString(renderIntl.locale, {
		timeZone: renderIntl.timeZone,
	});
}

export function resolveBrowserRenderIntlConfig(
	fallback: RenderIntlConfig,
): RenderIntlConfig {
	if (typeof navigator === "undefined") {
		return fallback;
	}

	const localeCandidates = Array.isArray(navigator.languages)
		? [...navigator.languages, navigator.language]
		: [navigator.language];
	const locale =
		localeCandidates
			.map((candidate) => parseRenderLocale(candidate))
			.find((candidate): candidate is string => Boolean(candidate)) ??
		fallback.locale;

	const timeZone =
		parseRenderTimeZone(
			new Intl.DateTimeFormat().resolvedOptions().timeZone ?? fallback.timeZone,
		) ?? fallback.timeZone;

	return {
		locale,
		timeZone,
	};
}

export function isRelativeTimeCandidate(
	value: Date | string | number,
	now = Date.now(),
): boolean {
	const date = value instanceof Date ? value : new Date(value);
	const delta = now - date.getTime();
	return delta >= 0 && delta < DAY_IN_MS;
}

export function formatRelativeTime(
	value: Date | string | number,
	renderIntl: RenderIntlConfig,
	now = Date.now(),
): string {
	const date = value instanceof Date ? value : new Date(value);
	const delta = now - date.getTime();

	if (delta < MINUTE_IN_MS) {
		return "just now";
	}

	const formatter = new Intl.RelativeTimeFormat(renderIntl.locale, {
		numeric: "always",
	});

	if (delta < HOUR_IN_MS) {
		return formatter.format(-Math.floor(delta / MINUTE_IN_MS), "minute");
	}

	return formatter.format(-Math.floor(delta / HOUR_IN_MS), "hour");
}

export function formatTimestampLabel(
	value: Date | string | number,
	renderIntl: RenderIntlConfig,
	now = Date.now(),
): string {
	if (isRelativeTimeCandidate(value, now)) {
		return formatRelativeTime(value, renderIntl, now);
	}

	return formatDateTime(value, renderIntl);
}
