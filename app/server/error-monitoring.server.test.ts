import assert from "node:assert/strict";
import test from "node:test";
import {
	captureMonitoredError,
	resetErrorMonitoringForTest,
} from "./error-monitoring.server.ts";

test("captureMonitoredError returns disabled when config is disabled", async () => {
	resetErrorMonitoringForTest();
	const result = await captureMonitoredError({
		event: "test.event",
		error: new Error("boom"),
		config: {
			enabled: false,
			webhookUrl: "",
			alertWebhookUrl: "",
			sampleRate: 1,
			dedupeWindowSeconds: 60,
		},
	});
	assert.equal(result.captured, false);
	assert.equal(result.reason, "disabled");
});

test("captureMonitoredError applies sampling and dedupe", async () => {
	resetErrorMonitoringForTest();
	const sampledOut = await captureMonitoredError({
		event: "test.event",
		error: new Error("boom"),
		config: {
			enabled: true,
			webhookUrl: "",
			alertWebhookUrl: "",
			sampleRate: 0,
			dedupeWindowSeconds: 60,
		},
		random: () => 0.5,
	});
	assert.equal(sampledOut.captured, false);
	assert.equal(sampledOut.reason, "sampled_out");

	const first = await captureMonitoredError({
		event: "test.event",
		error: new Error("same"),
		request: new Request("http://localhost:5173/feed"),
		config: {
			enabled: true,
			webhookUrl: "",
			alertWebhookUrl: "",
			sampleRate: 1,
			dedupeWindowSeconds: 60,
		},
		nowMs: 1_000,
	});
	assert.equal(first.captured, true);

	const deduped = await captureMonitoredError({
		event: "test.event",
		error: new Error("same"),
		request: new Request("http://localhost:5173/feed"),
		config: {
			enabled: true,
			webhookUrl: "",
			alertWebhookUrl: "",
			sampleRate: 1,
			dedupeWindowSeconds: 60,
		},
		nowMs: 2_000,
	});
	assert.equal(deduped.captured, false);
	assert.equal(deduped.reason, "deduped");
});

test("captureMonitoredError sends payload with transport when webhook configured", async () => {
	resetErrorMonitoringForTest();
	let transportCalls = 0;
	await captureMonitoredError({
		event: "test.webhook",
		error: new Error("webhook"),
		force: true,
		config: {
			enabled: false,
			webhookUrl: "https://example.invalid/hook",
			alertWebhookUrl: "",
			sampleRate: 0,
			dedupeWindowSeconds: 60,
		},
		transport: async (payload, webhookUrl) => {
			transportCalls += 1;
			assert.equal(webhookUrl, "https://example.invalid/hook");
			assert.equal(payload.event, "test.webhook");
			assert.equal(payload.message, "webhook");
		},
	});
	assert.equal(transportCalls, 1);
});

test("captureMonitoredError routes high severity events to alert webhook", async () => {
	resetErrorMonitoringForTest();
	const sent: Array<{ webhookUrl: string; event: string }> = [];
	await captureMonitoredError({
		event: "auth.request.failed",
		error: new Error("high-severity"),
		force: true,
		config: {
			enabled: true,
			webhookUrl: "https://example.invalid/default",
			alertWebhookUrl: "https://example.invalid/alerts",
			sampleRate: 1,
			dedupeWindowSeconds: 60,
		},
		transport: async (payload, webhookUrl) => {
			sent.push({
				webhookUrl,
				event: payload.event,
			});
		},
	});

	assert.equal(sent.length, 2);
	assert.equal(
		sent.some((entry) => entry.webhookUrl === "https://example.invalid/default"),
		true,
	);
	assert.equal(
		sent.some((entry) => entry.webhookUrl === "https://example.invalid/alerts"),
		true,
	);
});
