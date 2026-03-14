import type { LoaderFunctionArgs } from "react-router";
import { captureMonitoredError } from "~/server/error-monitoring.server";
import {
	canAccessAuditLogs,
	getViewerContext,
} from "~/server/permissions.server";

export async function loader({ request }: LoaderFunctionArgs) {
	const viewer = await getViewerContext({ request });
	if (!viewer.authUser) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}
	if (!canAccessAuditLogs({ viewerRole: viewer.viewerRole }).allowed) {
		return new Response(JSON.stringify({ error: "Forbidden" }), {
			status: 403,
			headers: { "Content-Type": "application/json" },
		});
	}

	const result = await captureMonitoredError({
		event: "error_monitoring.controlled_test",
		error: new Error("Controlled error monitoring test event"),
		request,
		force: true,
		tags: {
			trigger: "manual",
			actorId: viewer.authUser.id,
		},
	});

	return new Response(
		JSON.stringify({
			ok: true,
			captured: result.captured,
			reason: result.reason,
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
}

export default function DebugErrorMonitoringRoute() {
	return null;
}
