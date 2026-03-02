import type { LoaderFunctionArgs } from "react-router";
import { getMetricsSnapshot } from "~/server/metrics.server";

export async function loader(_args: LoaderFunctionArgs) {
	const metrics = await getMetricsSnapshot();
	return new Response(metrics, {
		status: 200,
		headers: {
			"Content-Type": "text/plain; version=0.0.4; charset=utf-8",
			"Cache-Control": "no-store",
		},
	});
}

export default function MetricsRoute() {
	return null;
}
