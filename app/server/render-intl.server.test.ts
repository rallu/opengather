import assert from "node:assert/strict";
import test from "node:test";

import {
	DEFAULT_RENDER_INTL_CONFIG,
	formatDateTime,
	formatRelativeTime,
	formatTimestampLabel,
	isRelativeTimeCandidate,
	parseRenderLocale,
	parseRenderTimeZone,
} from "../lib/render-intl.ts";

test("parseRenderLocale canonicalizes valid locales", () => {
	assert.equal(parseRenderLocale("en-us"), "en-US");
	assert.equal(parseRenderLocale(" fi-fi "), "fi-FI");
});

test("parseRenderLocale rejects invalid locales", () => {
	assert.equal(parseRenderLocale("not a locale"), null);
	assert.equal(parseRenderLocale(""), null);
});

test("parseRenderTimeZone canonicalizes valid time zones", () => {
	assert.equal(parseRenderTimeZone("utc"), "UTC");
	assert.equal(parseRenderTimeZone(" Europe/Helsinki "), "Europe/Helsinki");
});

test("parseRenderTimeZone rejects invalid time zones", () => {
	assert.equal(parseRenderTimeZone("Mars/Olympus"), null);
	assert.equal(parseRenderTimeZone(""), null);
});

test("formatDateTime uses the configured locale and time zone", () => {
	const timestamp = "2026-03-14T08:30:00.000Z";

	assert.equal(
		formatDateTime(timestamp, DEFAULT_RENDER_INTL_CONFIG),
		new Date(timestamp).toLocaleString("en-US", { timeZone: "UTC" }),
	);
	assert.equal(
		formatDateTime(timestamp, {
			locale: "fi-FI",
			timeZone: "Europe/Helsinki",
		}),
		new Date(timestamp).toLocaleString("fi-FI", {
			timeZone: "Europe/Helsinki",
		}),
	);
});

test("recent timestamps are formatted as relative time", () => {
	const now = Date.parse("2026-03-14T12:00:00.000Z");
	const twoHoursAgo = "2026-03-14T10:00:00.000Z";

	assert.equal(isRelativeTimeCandidate(twoHoursAgo, now), true);
	assert.equal(
		formatRelativeTime(twoHoursAgo, DEFAULT_RENDER_INTL_CONFIG, now),
		"2 hours ago",
	);
	assert.equal(
		formatTimestampLabel(twoHoursAgo, DEFAULT_RENDER_INTL_CONFIG, now),
		"2 hours ago",
	);
});

test("older timestamps keep the absolute timestamp label", () => {
	const now = Date.parse("2026-03-15T12:00:00.000Z");
	const oldTimestamp = "2026-03-14T08:30:00.000Z";

	assert.equal(isRelativeTimeCandidate(oldTimestamp, now), false);
	assert.equal(
		formatTimestampLabel(oldTimestamp, DEFAULT_RENDER_INTL_CONFIG, now),
		formatDateTime(oldTimestamp, DEFAULT_RENDER_INTL_CONFIG),
	);
});
