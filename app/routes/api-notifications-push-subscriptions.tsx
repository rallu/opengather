import type { ActionFunctionArgs } from "react-router";
import { hasPushConfig } from "~/server/env.server.ts";
import {
	deleteWebPushSubscriptionByEndpoint,
	parseWebPushSubscriptionInput,
	upsertWebPushSubscription,
} from "~/server/push-subscription.server.ts";
import { getAuthUserFromRequest } from "~/server/session.server";

export async function action({ request }: ActionFunctionArgs) {
	const authUser = await getAuthUserFromRequest({ request });
	if (!authUser) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!hasPushConfig()) {
		return Response.json(
			{ error: "Web push is not configured on this server." },
			{ status: 503 },
		);
	}

	if (request.method === "POST") {
		const body = (await request.json().catch(() => null)) as {
			subscription?: unknown;
		} | null;
		const parsed = parseWebPushSubscriptionInput(body?.subscription);
		if (!parsed.ok) {
			return Response.json({ error: parsed.error }, { status: 400 });
		}

		await upsertWebPushSubscription({
			userId: authUser.id,
			userAgent: request.headers.get("user-agent") ?? "",
			subscription: parsed.value,
		});

		return Response.json({ ok: true });
	}

	if (request.method === "DELETE") {
		const body = (await request.json().catch(() => null)) as {
			endpoint?: unknown;
		} | null;
		const endpoint =
			typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
		if (!endpoint) {
			return Response.json(
				{ error: "Missing subscription endpoint." },
				{ status: 400 },
			);
		}

		await deleteWebPushSubscriptionByEndpoint({
			userId: authUser.id,
			endpoint,
		});

		return Response.json({ ok: true });
	}

	return Response.json({ error: "Method not allowed" }, { status: 405 });
}
