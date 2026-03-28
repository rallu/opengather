import { randomUUID } from "node:crypto";
import { getDb } from "./db.server.ts";

export type WebPushSubscriptionInput = {
	endpoint: string;
	expirationTime: number | null;
	keys: {
		auth: string;
		p256dh: string;
	};
};

export function parseWebPushSubscriptionInput(
	raw: unknown,
):
	| { ok: true; value: WebPushSubscriptionInput }
	| { ok: false; error: string } {
	if (typeof raw !== "object" || raw === null) {
		return { ok: false, error: "Missing push subscription payload." };
	}

	const candidate = raw as Partial<WebPushSubscriptionInput>;
	const endpoint =
		typeof candidate.endpoint === "string" ? candidate.endpoint.trim() : "";
	const expirationTime =
		typeof candidate.expirationTime === "number" &&
		Number.isFinite(candidate.expirationTime)
			? candidate.expirationTime
			: null;
	const keys =
		typeof candidate.keys === "object" && candidate.keys !== null
			? (candidate.keys as Partial<WebPushSubscriptionInput["keys"]>)
			: null;
	const auth = typeof keys?.auth === "string" ? keys.auth.trim() : "";
	const p256dh = typeof keys?.p256dh === "string" ? keys.p256dh.trim() : "";

	if (!endpoint) {
		return { ok: false, error: "Push subscription endpoint is required." };
	}

	if (!auth || !p256dh) {
		return { ok: false, error: "Push subscription keys are required." };
	}

	return {
		ok: true,
		value: {
			endpoint,
			expirationTime,
			keys: {
				auth,
				p256dh,
			},
		},
	};
}

export async function upsertWebPushSubscription(params: {
	userId: string;
	userAgent: string;
	subscription: WebPushSubscriptionInput;
}): Promise<void> {
	const expiresAt =
		params.subscription.expirationTime === null
			? null
			: new Date(params.subscription.expirationTime);

	await getDb().webPushSubscription.upsert({
		where: {
			endpoint: params.subscription.endpoint,
		},
		create: {
			id: randomUUID(),
			userId: params.userId,
			endpoint: params.subscription.endpoint,
			p256dhKey: params.subscription.keys.p256dh,
			authKey: params.subscription.keys.auth,
			expiresAt,
			userAgent: params.userAgent || null,
			lastSuccessfulAt: null,
			lastFailureAt: null,
			lastFailureStatus: null,
			lastFailureReason: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		update: {
			userId: params.userId,
			p256dhKey: params.subscription.keys.p256dh,
			authKey: params.subscription.keys.auth,
			expiresAt,
			userAgent: params.userAgent || null,
			updatedAt: new Date(),
		},
	});
}

export async function deleteWebPushSubscriptionByEndpoint(params: {
	userId: string;
	endpoint: string;
}): Promise<void> {
	await getDb().webPushSubscription.deleteMany({
		where: {
			userId: params.userId,
			endpoint: params.endpoint,
		},
	});
}

export async function deleteWebPushSubscriptionsById(params: {
	ids: string[];
}): Promise<void> {
	if (params.ids.length === 0) {
		return;
	}

	await getDb().webPushSubscription.deleteMany({
		where: {
			id: {
				in: params.ids,
			},
		},
	});
}

export async function markWebPushSubscriptionsDelivered(params: {
	ids: string[];
}): Promise<void> {
	if (params.ids.length === 0) {
		return;
	}

	await getDb().webPushSubscription.updateMany({
		where: {
			id: {
				in: params.ids,
			},
		},
		data: {
			lastSuccessfulAt: new Date(),
			lastFailureAt: null,
			lastFailureStatus: null,
			lastFailureReason: null,
			updatedAt: new Date(),
		},
	});
}

export async function markWebPushSubscriptionFailed(params: {
	id: string;
	statusCode?: number;
	reason?: string;
}): Promise<void> {
	await getDb().webPushSubscription.update({
		where: {
			id: params.id,
		},
		data: {
			lastFailureAt: new Date(),
			lastFailureStatus: params.statusCode ?? null,
			lastFailureReason: params.reason ?? null,
			updatedAt: new Date(),
		},
	});
}

export async function listActiveWebPushSubscriptions(params: {
	userId: string;
}): Promise<
	Array<{
		id: string;
		endpoint: string;
		p256dhKey: string;
		authKey: string;
	}>
> {
	const rows = await getDb().webPushSubscription.findMany({
		where: {
			userId: params.userId,
			OR: [
				{ expiresAt: null },
				{
					expiresAt: {
						gt: new Date(),
					},
				},
			],
		},
		select: {
			id: true,
			endpoint: true,
			p256dhKey: true,
			authKey: true,
		},
	});

	return rows;
}

export async function countWebPushSubscriptions(params: {
	userId: string;
}): Promise<number> {
	return await getDb().webPushSubscription.count({
		where: {
			userId: params.userId,
		},
	});
}
