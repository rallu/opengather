import "dotenv/config";

import { logError, logInfo } from "../app/server/logger.server.ts";
import { processPendingMediaJobs } from "../app/server/post-assets.server.ts";

const pollIntervalMs = Number(process.env.MEDIA_WORKER_POLL_MS ?? 5000);
const once = process.argv.includes("--once");

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
	logInfo({
		event: "media.worker.started",
		data: {
			once,
			pollIntervalMs,
		},
	});

	for (;;) {
		const processed = await processPendingMediaJobs({ limit: 5 });
		if (once) {
			return;
		}
		if (processed === 0) {
			await sleep(pollIntervalMs);
		}
	}
}

main().catch((error) => {
	logError({
		event: "media.worker.failed",
		data: {
			error: error instanceof Error ? error.message : "unknown error",
		},
	});
	process.exitCode = 1;
});
