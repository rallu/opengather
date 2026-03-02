import assert from "node:assert/strict";
import test from "node:test";
import {
	buildRateLimitHeaders,
	checkRateLimit,
	resetRateLimitsForTest,
} from "./rate-limit.server.ts";

test("checkRateLimit allows requests until limit and blocks after", () => {
	resetRateLimitsForTest();

	const first = checkRateLimit({
		bucket: "auth",
		key: "ip:1.1.1.1",
		limit: 2,
		windowMs: 60_000,
		nowMs: 1_000,
	});
	assert.equal(first.allowed, true);
	assert.equal(first.remaining, 1);

	const second = checkRateLimit({
		bucket: "auth",
		key: "ip:1.1.1.1",
		limit: 2,
		windowMs: 60_000,
		nowMs: 1_001,
	});
	assert.equal(second.allowed, true);
	assert.equal(second.remaining, 0);

	const blocked = checkRateLimit({
		bucket: "auth",
		key: "ip:1.1.1.1",
		limit: 2,
		windowMs: 60_000,
		nowMs: 1_002,
	});
	assert.equal(blocked.allowed, false);
	assert.equal(blocked.remaining, 0);
	assert.equal(blocked.retryAfterSeconds > 0, true);
});

test("checkRateLimit resets counters after the window expires", () => {
	resetRateLimitsForTest();

	checkRateLimit({
		bucket: "posting",
		key: "user:123",
		limit: 1,
		windowMs: 10,
		nowMs: 100,
	});

	const blocked = checkRateLimit({
		bucket: "posting",
		key: "user:123",
		limit: 1,
		windowMs: 10,
		nowMs: 105,
	});
	assert.equal(blocked.allowed, false);

	const allowedAgain = checkRateLimit({
		bucket: "posting",
		key: "user:123",
		limit: 1,
		windowMs: 10,
		nowMs: 111,
	});
	assert.equal(allowedAgain.allowed, true);
	assert.equal(allowedAgain.remaining, 0);
});

test("buildRateLimitHeaders adds Retry-After for blocked requests", () => {
	const headers = buildRateLimitHeaders({
		result: {
			allowed: false,
			limit: 10,
			remaining: 0,
			resetAtMs: 8_500,
			retryAfterSeconds: 9,
		},
	});

	assert.equal(headers["X-RateLimit-Limit"], "10");
	assert.equal(headers["X-RateLimit-Remaining"], "0");
	assert.equal(headers["X-RateLimit-Reset"], "8");
	assert.equal(headers["Retry-After"], "9");
});
