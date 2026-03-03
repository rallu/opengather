import { randomUUID } from "node:crypto";

type LogLevel = "info" | "warn" | "error";

export function getRequestId(request: Request): string {
	const existing = request.headers.get("x-request-id")?.trim();
	if (existing) {
		return existing;
	}
	return randomUUID();
}

export function buildRequestContext(params: {
	request: Request;
	requestId: string;
	userId?: string;
}): Record<string, unknown> {
	return {
		requestId: params.requestId,
		method: params.request.method,
		path: new URL(params.request.url).pathname,
		userId: params.userId,
	};
}

export function toLogLine(params: {
	level: LogLevel;
	event: string;
	data?: Record<string, unknown>;
}): string {
	return JSON.stringify({
		timestamp: new Date().toISOString(),
		level: params.level,
		event: params.event,
		...(params.data ?? {}),
	});
}

export function logInfo(params: {
	event: string;
	data?: Record<string, unknown>;
}): void {
	console.log(
		toLogLine({ level: "info", event: params.event, data: params.data }),
	);
}

export function logWarn(params: {
	event: string;
	data?: Record<string, unknown>;
}): void {
	console.warn(
		toLogLine({ level: "warn", event: params.event, data: params.data }),
	);
}

export function logError(params: {
	event: string;
	data?: Record<string, unknown>;
}): void {
	console.error(
		toLogLine({ level: "error", event: params.event, data: params.data }),
	);
}
