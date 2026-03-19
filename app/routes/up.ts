import type { LoaderFunctionArgs } from "react-router";
import { ensureMediaRootExists } from "~/server/asset-storage.server.ts";
import { getDb } from "~/server/db.server.ts";
import { hasDatabaseConfig } from "~/server/env.server.ts";

export async function loader(_args: LoaderFunctionArgs) {
	try {
		if (!hasDatabaseConfig()) {
			throw new Error("DATABASE_URL is not configured");
		}

		await ensureMediaRootExists();
		await getDb().$queryRaw`SELECT 1`;

		return new Response("ok", {
			headers: {
				"cache-control": "no-store",
				"content-type": "text/plain; charset=utf-8",
			},
		});
	} catch {
		return new Response("unavailable", {
			status: 503,
			headers: {
				"cache-control": "no-store",
				"content-type": "text/plain; charset=utf-8",
			},
		});
	}
}
