import assert from "node:assert/strict";
import test from "node:test";
import {
	buildRequestContext,
	getRequestId,
	toLogLine,
} from "./logger.server.ts";

test("getRequestId reuses incoming x-request-id", () => {
	const request = new Request("http://localhost:5173/feed", {
		headers: {
			"x-request-id": "req-123",
		},
	});

	assert.equal(getRequestId(request), "req-123");
});

test("buildRequestContext includes method/path/requestId/userId", () => {
	const request = new Request("http://localhost:5173/community", {
		method: "POST",
	});
	const context = buildRequestContext({
		request,
		requestId: "req-999",
		userId: "user-1",
	});

	assert.equal(context.requestId, "req-999");
	assert.equal(context.method, "POST");
	assert.equal(context.path, "/community");
	assert.equal(context.userId, "user-1");
});

test("toLogLine renders JSON with level and event", () => {
	const line = toLogLine({
		level: "info",
		event: "community.post.created",
		data: { requestId: "req-1" },
	});
	const parsed = JSON.parse(line) as Record<string, unknown>;

	assert.equal(parsed.level, "info");
	assert.equal(parsed.event, "community.post.created");
	assert.equal(parsed.requestId, "req-1");
	assert.equal(typeof parsed.timestamp, "string");
});
