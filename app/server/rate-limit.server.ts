type RateLimitWindow = {
	count: number;
	resetAtMs: number;
};

const rateLimitStore = new Map<string, Map<string, RateLimitWindow>>();

let operationsSinceCleanup = 0;

function cleanupExpiredWindows(nowMs: number): void {
	operationsSinceCleanup += 1;
	if (operationsSinceCleanup < 1_000) {
		return;
	}
	operationsSinceCleanup = 0;

	for (const [bucket, keys] of rateLimitStore.entries()) {
		for (const [key, window] of keys.entries()) {
			if (window.resetAtMs <= nowMs) {
				keys.delete(key);
			}
		}
		if (keys.size === 0) {
			rateLimitStore.delete(bucket);
		}
	}
}

function getOrCreateBucket(bucket: string): Map<string, RateLimitWindow> {
	const existing = rateLimitStore.get(bucket);
	if (existing) {
		return existing;
	}

	const created = new Map<string, RateLimitWindow>();
	rateLimitStore.set(bucket, created);
	return created;
}

export type RateLimitResult = {
	allowed: boolean;
	limit: number;
	remaining: number;
	resetAtMs: number;
	retryAfterSeconds: number;
};

export function checkRateLimit(params: {
	bucket: string;
	key: string;
	limit: number;
	windowMs: number;
	nowMs?: number;
}): RateLimitResult {
	const nowMs = params.nowMs ?? Date.now();
	cleanupExpiredWindows(nowMs);

	const bucketStore = getOrCreateBucket(params.bucket);
	const current = bucketStore.get(params.key);

	if (!current || current.resetAtMs <= nowMs) {
		const resetAtMs = nowMs + params.windowMs;
		bucketStore.set(params.key, { count: 1, resetAtMs });
		return {
			allowed: true,
			limit: params.limit,
			remaining: Math.max(0, params.limit - 1),
			resetAtMs,
			retryAfterSeconds: 0,
		};
	}

	if (current.count >= params.limit) {
		return {
			allowed: false,
			limit: params.limit,
			remaining: 0,
			resetAtMs: current.resetAtMs,
			retryAfterSeconds: Math.max(
				1,
				Math.ceil((current.resetAtMs - nowMs) / 1_000),
			),
		};
	}

	current.count += 1;
	bucketStore.set(params.key, current);
	return {
		allowed: true,
		limit: params.limit,
		remaining: Math.max(0, params.limit - current.count),
		resetAtMs: current.resetAtMs,
		retryAfterSeconds: 0,
	};
}

export function buildRateLimitHeaders(params: {
	result: RateLimitResult;
}): Record<string, string> {
	const resetAtSeconds = Math.floor(params.result.resetAtMs / 1_000);
	const headers: Record<string, string> = {
		"X-RateLimit-Limit": String(params.result.limit),
		"X-RateLimit-Remaining": String(params.result.remaining),
		"X-RateLimit-Reset": String(resetAtSeconds),
	};

	if (!params.result.allowed) {
		headers["Retry-After"] = String(params.result.retryAfterSeconds);
	}

	return headers;
}

export function getRequestIp(request: Request): string {
	const cfConnectingIp = request.headers.get("cf-connecting-ip");
	if (cfConnectingIp) {
		return cfConnectingIp.trim();
	}

	const xForwardedFor = request.headers.get("x-forwarded-for");
	if (xForwardedFor) {
		const [firstIp] = xForwardedFor.split(",");
		if (firstIp) {
			return firstIp.trim();
		}
	}

	return "unknown";
}

export function resetRateLimitsForTest(): void {
	rateLimitStore.clear();
	operationsSinceCleanup = 0;
}
