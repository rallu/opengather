import { randomUUID } from "node:crypto";
import { getConfig } from "./config.service.server.ts";
import { getDb } from "./db.server.ts";
import {
	type NotificationKind,
	type NotificationPayloadByKind,
	notificationKinds,
} from "./notification.types.server.ts";

function isNotificationKind(value: string): value is NotificationKind {
	return notificationKinds.includes(value as NotificationKind);
}

export type NotificationChannels = {
	email: boolean;
	push: boolean;
	webhook: boolean;
	hub: boolean;
	webhookUrl?: string;
};

const defaultChannels: NotificationChannels = {
	email: false,
	push: false,
	webhook: false,
	hub: true,
	webhookUrl: "",
};

function parseChannels(raw: unknown): NotificationChannels {
	if (typeof raw !== "object" || raw === null) {
		return defaultChannels;
	}
	const data = raw as Partial<NotificationChannels>;
	return {
		email: Boolean(data.email),
		push: Boolean(data.push),
		webhook: Boolean(data.webhook),
		hub: data.hub === undefined ? true : Boolean(data.hub),
		webhookUrl: typeof data.webhookUrl === "string" ? data.webhookUrl : "",
	};
}

function toHubOutboxType(params: {
	kind: NotificationKind;
}): "mention" | "reply" | null {
	if (params.kind === "mention") {
		return "mention";
	}
	if (params.kind === "reply_to_post") {
		return "reply";
	}
	return null;
}

export async function createNotification<K extends NotificationKind>(params: {
	userId: string;
	kind: K;
	title: string;
	body: string;
	targetUrl?: string;
	relatedEntityId?: string;
	payload: NotificationPayloadByKind[K];
}): Promise<{
	id: string;
	userId: string;
	kind: NotificationKind;
	title: string;
	body: string;
	targetUrl?: string;
	relatedEntityId?: string;
	readAt?: string;
	createdAt: string;
}> {
	if (!isNotificationKind(params.kind)) {
		throw new Error(`Unsupported notification kind: ${params.kind}`);
	}

	const db = getDb();
	const row = await db.notification.create({
		data: {
			id: randomUUID(),
			userId: params.userId,
			kind: params.kind,
			title: params.title,
			body: params.body,
			targetUrl: params.targetUrl ?? null,
			relatedEntityId: params.relatedEntityId ?? null,
			payload: params.payload as object,
			readAt: null,
			createdAt: new Date(),
		},
	});

	const channels = await getNotificationChannels({
		userId: params.userId,
	});
	const hubType = toHubOutboxType({ kind: params.kind });
	if (channels.hub && hubType) {
		const hubAccount = await db.account.findFirst({
			where: {
				userId: params.userId,
				providerId: "hub",
			},
			select: {
				accountId: true,
			},
		});
		if (hubAccount?.accountId) {
			await db.notificationOutbox.create({
				data: {
					id: randomUUID(),
					recipientHubUserId: hubAccount.accountId,
					type: hubType,
					title: params.title,
					body: params.body,
					targetUrl: params.targetUrl ?? null,
					instanceBaseUrl: await getConfig("hub_instance_base_url"),
					status: "pending",
					attempts: 0,
					maxAttempts: 8,
					lastError: null,
					nextAttemptAt: new Date(),
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			});
		}
	}

	return {
		id: row.id,
		userId: row.userId,
		kind: row.kind as NotificationKind,
		title: row.title,
		body: row.body,
		targetUrl: row.targetUrl ?? undefined,
		relatedEntityId: row.relatedEntityId ?? undefined,
		readAt: row.readAt?.toISOString(),
		createdAt: row.createdAt.toISOString(),
	};
}

export async function getNotificationChannels(params: {
	userId: string;
}): Promise<NotificationChannels> {
	const row = await getDb().notificationPreference.findUnique({
		where: {
			userId: params.userId,
		},
		select: {
			channels: true,
		},
	});
	if (!row) {
		return defaultChannels;
	}
	return parseChannels(row.channels);
}

export async function setNotificationChannels(params: {
	userId: string;
	channels: NotificationChannels;
}): Promise<NotificationChannels> {
	const parsed = parseChannels(params.channels);
	await getDb().notificationPreference.upsert({
		where: {
			userId: params.userId,
		},
		create: {
			id: randomUUID(),
			userId: params.userId,
			channels: parsed as object,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		update: {
			channels: parsed as object,
			updatedAt: new Date(),
		},
	});
	return parsed;
}

export async function listNotifications(params: {
	userId: string;
	onlyUnread?: boolean;
	limit?: number;
	offset?: number;
}): Promise<
	Array<{
		id: string;
		kind: string;
		title: string;
		body: string;
		targetUrl?: string;
		relatedEntityId?: string;
		readAt?: string;
		createdAt: string;
	}>
> {
	const rows = await getDb().notification.findMany({
		where: {
			userId: params.userId,
			...(params.onlyUnread ? { readAt: null } : {}),
		},
		orderBy: { createdAt: "desc" },
		take: params.limit ?? 50,
		skip: params.offset ?? 0,
	});

	return rows.map((row) => ({
		id: row.id,
		kind: row.kind,
		title: row.title,
		body: row.body,
		targetUrl: row.targetUrl ?? undefined,
		relatedEntityId: row.relatedEntityId ?? undefined,
		readAt: row.readAt?.toISOString(),
		createdAt: row.createdAt.toISOString(),
	}));
}

export async function countUnreadNotifications(params: {
	userId: string;
}): Promise<number> {
	return getDb().notification.count({
		where: {
			userId: params.userId,
			readAt: null,
		},
	});
}

export async function markNotificationRead(params: {
	userId: string;
	notificationId: string;
}): Promise<void> {
	await getDb().notification.updateMany({
		where: {
			id: params.notificationId,
			userId: params.userId,
		},
		data: {
			readAt: new Date(),
		},
	});
}

export async function markAllNotificationsRead(params: {
	userId: string;
}): Promise<number> {
	const result = await getDb().notification.updateMany({
		where: {
			userId: params.userId,
			readAt: null,
		},
		data: {
			readAt: new Date(),
		},
	});
	return result.count;
}

export async function markNotificationsReadByRelatedEntityId(params: {
	relatedEntityId: string;
}): Promise<number> {
	const result = await getDb().notification.updateMany({
		where: {
			relatedEntityId: params.relatedEntityId,
			readAt: null,
		},
		data: {
			readAt: new Date(),
		},
	});

	return result.count;
}
