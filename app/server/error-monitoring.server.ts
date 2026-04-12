import { getConfig } from "./config.service.server.ts";
import { logError, logInfo } from "./logger.server.ts";

type ErrorMonitoringConfig = {
	enabled: boolean;
	webhookUrl: string;
	alertWebhookUrl: string;
	sampleRate: number;
	dedupeWindowSeconds: number;
};

type ErrorPayload = {
	timestamp: string;
	event: string;
	message: string;
	stack?: string;
	tags: Record<string, string>;
	request?: {
		requestId: string;
		method: string;
		path: string;
	};
	extra?: Record<string, unknown>;
};

const fingerprintLastSeenMs = new Map<string, number>();

function clampSampleRate(value: number): number {
	if (Number.isNaN(value)) {
		return 1;
	}
	return Math.max(0, Math.min(1, value));
}

function normalizeDedupeWindow(value: number): number {
	if (Number.isNaN(value) || value < 0) {
		return 60;
	}
	return value;
}

function fingerprintFor(params: {
	event: string;
	error: Error;
	path?: string;
}): string {
	return `${params.event}|${params.error.message}|${params.path ?? "no-path"}`;
}

function shouldSkipByDedupe(params: {
	fingerprint: string;
	nowMs: number;
	dedupeWindowSeconds: number;
}): boolean {
	const lastSeen = fingerprintLastSeenMs.get(params.fingerprint);
	if (lastSeen === undefined) {
		fingerprintLastSeenMs.set(params.fingerprint, params.nowMs);
		return false;
	}
	if (params.nowMs - lastSeen < params.dedupeWindowSeconds * 1000) {
		return true;
	}
	fingerprintLastSeenMs.set(params.fingerprint, params.nowMs);
	return false;
}

function severityForEvent(event: string): "high" | "medium" | "low" {
	if (
		event === "server.render.error" ||
		event === "setup.persist_failed" ||
		event === "auth.request.failed" ||
		event === "community.action.failed" ||
		event.startsWith("error_monitoring.controlled_test")
	) {
		return "high";
	}
	if (event.endsWith(".failed")) {
		return "medium";
	}
	return "low";
}

export async function loadErrorMonitoringConfig(): Promise<ErrorMonitoringConfig> {
	const [
		enabled,
		webhookUrl,
		alertWebhookUrl,
		sampleRate,
		dedupeWindowSeconds,
	] = await Promise.all([
		getConfig("error_monitoring_enabled"),
		getConfig("error_monitoring_webhook_url"),
		getConfig("error_monitoring_alert_webhook_url"),
		getConfig("error_monitoring_sample_rate"),
		getConfig("error_monitoring_dedupe_window_seconds"),
	]);

	return {
		enabled,
		webhookUrl,
		alertWebhookUrl,
		sampleRate: clampSampleRate(sampleRate),
		dedupeWindowSeconds: normalizeDedupeWindow(dedupeWindowSeconds),
	};
}

export async function captureMonitoredError(params: {
	event: string;
	error: unknown;
	request?: Request;
	tags?: Record<string, string>;
	extra?: Record<string, unknown>;
	force?: boolean;
	config?: ErrorMonitoringConfig;
	nowMs?: number;
	random?: () => number;
	transport?: (payload: ErrorPayload, webhookUrl: string) => Promise<void>;
}): Promise<{ captured: boolean; reason?: string }> {
	const error =
		params.error instanceof Error
			? params.error
			: new Error(
					typeof params.error === "string" ? params.error : "Unknown error",
				);
	const config = params.config ?? (await loadErrorMonitoringConfig());
	const nowMs = params.nowMs ?? Date.now();
	const random = params.random ?? Math.random;

	if (!params.force && !config.enabled) {
		return { captured: false, reason: "disabled" };
	}

	if (!params.force && random() > config.sampleRate) {
		return { captured: false, reason: "sampled_out" };
	}

	const path = params.request
		? new URL(params.request.url).pathname
		: undefined;
	const fingerprint = fingerprintFor({
		event: params.event,
		error,
		path,
	});
	if (
		!params.force &&
		shouldSkipByDedupe({
			fingerprint,
			nowMs,
			dedupeWindowSeconds: config.dedupeWindowSeconds,
		})
	) {
		return { captured: false, reason: "deduped" };
	}

	const requestId = params.request?.headers.get("x-request-id") ?? "";
	const severity = severityForEvent(params.event);
	const payload: ErrorPayload = {
		timestamp: new Date(nowMs).toISOString(),
		event: params.event,
		message: error.message,
		stack: error.stack,
		tags: {
			environment: process.env.NODE_ENV ?? "development",
			service: "opengather-web",
			release: process.env.npm_package_version ?? "unknown",
			severity,
			...(params.tags ?? {}),
		},
		extra: params.extra,
		...(params.request
			? {
					request: {
						requestId,
						method: params.request.method,
						path: new URL(params.request.url).pathname,
					},
				}
			: {}),
	};

	logError({
		event: "error_monitoring.capture",
		data: payload as unknown as Record<string, unknown>,
	});

	const transport =
		params.transport ??
		(async (body: ErrorPayload, webhookUrl: string) => {
			await fetch(webhookUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			});
		});
	if (config.webhookUrl) {
		try {
			await transport(payload, config.webhookUrl);
			logInfo({
				event: "error_monitoring.delivery_ok",
				data: {
					sourceEvent: params.event,
					webhookUrl: config.webhookUrl,
				},
			});
		} catch (deliveryError) {
			logError({
				event: "error_monitoring.delivery_failed",
				data: {
					sourceEvent: params.event,
					error:
						deliveryError instanceof Error
							? deliveryError.message
							: "delivery_failed",
				},
			});
		}
	}
	if (severity === "high" && config.alertWebhookUrl) {
		try {
			await transport(payload, config.alertWebhookUrl);
			logInfo({
				event: "error_monitoring.alert_routing_ok",
				data: {
					sourceEvent: params.event,
					alertWebhookUrl: config.alertWebhookUrl,
				},
			});
		} catch (deliveryError) {
			logError({
				event: "error_monitoring.alert_routing_failed",
				data: {
					sourceEvent: params.event,
					error:
						deliveryError instanceof Error
							? deliveryError.message
							: "alert_delivery_failed",
				},
			});
		}
	}

	return { captured: true };
}

export function resetErrorMonitoringForTest(): void {
	fingerprintLastSeenMs.clear();
}
