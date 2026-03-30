import { randomUUID } from "node:crypto";
import {
	isNotificationChannelSupported,
	type NotificationChannel,
	notificationChannels,
	notificationKinds,
} from "../lib/notification-preferences.ts";
import { getConfig, getServerConfig } from "./config.service.server.ts";
import { getDb } from "./db.server.ts";
import { hasPushConfig } from "./env.server.ts";
import type { HubNotificationDeliveryMode } from "./hub.service.server.ts";
import { logError } from "./logger.server.ts";
import type {
	NotificationKind,
	NotificationPayloadByKind,
} from "./notification.types.server.ts";
import { sendNotificationWebPush } from "./web-push.server.ts";
import { sendNotificationWebhook } from "./webhook-notification.server.ts";

function isNotificationKind(value: string): value is NotificationKind {
	return notificationKinds.includes(value as NotificationKind);
}

export type NotificationChannelMatrix = Record<
	NotificationKind,
	Record<NotificationChannel, boolean>
>;

export type NotificationPreferences = {
	matrix: NotificationChannelMatrix;
	webhookUrl?: string;
};

export type NotificationChannelAvailability = Record<
	NotificationChannel,
	{
		enabled: boolean;
		reason?: string;
	}
>;

type LegacyNotificationChannels = {
	email?: boolean;
	hub?: boolean;
	push?: boolean;
	webhook?: boolean;
	webhookUrl?: string;
};

function createDefaultNotificationChannelRow(
	kind: NotificationKind,
): Record<NotificationChannel, boolean> {
	return {
		push: false,
		hub: kind === "mention" || kind === "reply_to_post",
		webhook: false,
		email: false,
	};
}

export function createDefaultNotificationChannelMatrix(): NotificationChannelMatrix {
	return Object.fromEntries(
		notificationKinds.map((kind) => [
			kind,
			createDefaultNotificationChannelRow(kind),
		]),
	) as NotificationChannelMatrix;
}

export function createDefaultNotificationPreferences(): NotificationPreferences {
	return {
		matrix: createDefaultNotificationChannelMatrix(),
		webhookUrl: "",
	};
}

export async function getNotificationChannelAvailability(): Promise<NotificationChannelAvailability> {
	const serverConfig = await getServerConfig().catch(() => null);

	return {
		push: hasPushConfig()
			? { enabled: true }
			: {
					enabled: false,
					reason:
						"Push delivery is unavailable because VAPID keys are not configured on this server.",
				},
		hub:
			serverConfig?.hubAvailable &&
			serverConfig.hubEnabled &&
			Boolean(serverConfig.hubInstanceBaseUrl)
				? { enabled: true }
				: {
						enabled: false,
						reason:
							"Hub delivery is unavailable because Hub integration is not enabled on this server.",
					},
		webhook: { enabled: true },
		email: {
			enabled: false,
			reason: "Email delivery is not implemented yet.",
		},
	};
}

export function applyNotificationChannelAvailability(params: {
	availability: NotificationChannelAvailability;
	preferences: NotificationPreferences;
}): NotificationPreferences {
	return {
		matrix: Object.fromEntries(
			notificationKinds.map((kind) => [
				kind,
				Object.fromEntries(
					notificationChannels.map((channel) => [
						channel,
						params.availability[channel].enabled
							? Boolean(params.preferences.matrix[kind][channel])
							: false,
					]),
				),
			]),
		) as NotificationChannelMatrix,
		webhookUrl: params.availability.webhook.enabled
			? (params.preferences.webhookUrl ?? "")
			: "",
	};
}

function parseNotificationMatrix(raw: unknown): NotificationChannelMatrix {
	const defaults = createDefaultNotificationChannelMatrix();
	if (typeof raw !== "object" || raw === null) {
		return defaults;
	}

	const data = raw as Partial<
		Record<NotificationKind, Partial<Record<NotificationChannel, unknown>>>
	>;

	return Object.fromEntries(
		notificationKinds.map((kind) => {
			const row =
				typeof data[kind] === "object" && data[kind] !== null ? data[kind] : {};

			return [
				kind,
				Object.fromEntries(
					notificationChannels.map((channel) => [
						channel,
						isNotificationChannelSupported({ kind, channel })
							? Boolean(row[channel])
							: false,
					]),
				),
			];
		}),
	) as NotificationChannelMatrix;
}

function parseLegacyNotificationPreferences(
	raw: LegacyNotificationChannels,
): NotificationPreferences {
	const defaults = createDefaultNotificationChannelMatrix();
	const legacyChannelValues: Record<NotificationChannel, boolean> = {
		push: Boolean(raw.push),
		hub: raw.hub === undefined ? true : Boolean(raw.hub),
		webhook: Boolean(raw.webhook),
		email: Boolean(raw.email),
	};

	return {
		matrix: Object.fromEntries(
			notificationKinds.map((kind) => [
				kind,
				Object.fromEntries(
					notificationChannels.map((channel) => [
						channel,
						isNotificationChannelSupported({ kind, channel })
							? legacyChannelValues[channel]
							: defaults[kind][channel],
					]),
				),
			]),
		) as NotificationChannelMatrix,
		webhookUrl: typeof raw.webhookUrl === "string" ? raw.webhookUrl : "",
	};
}

export function parseNotificationPreferences(
	raw: unknown,
): NotificationPreferences {
	if (typeof raw !== "object" || raw === null) {
		return createDefaultNotificationPreferences();
	}

	const data = raw as {
		matrix?: unknown;
		webhookUrl?: unknown;
	} & LegacyNotificationChannels;

	if ("matrix" in data) {
		return {
			matrix: parseNotificationMatrix(data.matrix),
			webhookUrl: typeof data.webhookUrl === "string" ? data.webhookUrl : "",
		};
	}

	return parseLegacyNotificationPreferences(data);
}

export function isNotificationChannelEnabled(params: {
	channel: NotificationChannel;
	kind: NotificationKind;
	preferences: NotificationPreferences;
}): boolean {
	return Boolean(params.preferences.matrix[params.kind][params.channel]);
}

export function hasAnyNotificationChannelEnabled(params: {
	channel: NotificationChannel;
	preferences: NotificationPreferences;
}): boolean {
	return notificationKinds.some((kind) =>
		isNotificationChannelEnabled({
			channel: params.channel,
			kind,
			preferences: params.preferences,
		}),
	);
}

function getHubNotificationDeliveryMode(params: {
	hubChannelEnabled: boolean;
	primaryDeliverySucceeded: boolean;
}): HubNotificationDeliveryMode {
	if (params.hubChannelEnabled && !params.primaryDeliverySucceeded) {
		return "deliver";
	}
	return "sync";
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

	const preferences = await getNotificationPreferences({
		userId: params.userId,
	});
	const channelAvailability = await getNotificationChannelAvailability();
	const hubChannelEnabled =
		channelAvailability.hub.enabled &&
		isNotificationChannelEnabled({
			channel: "hub",
			kind: params.kind,
			preferences,
		});
	let primaryDeliverySucceeded = false;

	if (
		channelAvailability.webhook.enabled &&
		isNotificationChannelEnabled({
			channel: "webhook",
			kind: params.kind,
			preferences,
		}) &&
		preferences.webhookUrl
	) {
		try {
			await sendNotificationWebhook({
				userId: params.userId,
				webhookUrl: preferences.webhookUrl,
				notification: {
					id: row.id,
					kind: row.kind as NotificationKind,
					title: row.title,
					body: row.body,
					targetUrl: row.targetUrl ?? undefined,
					relatedEntityId: row.relatedEntityId ?? undefined,
					createdAt: row.createdAt.toISOString(),
					payload: params.payload,
				},
			});
		} catch (error) {
			logError({
				event: "notification.webhook.failed",
				data: {
					userId: params.userId,
					notificationId: row.id,
					error:
						error instanceof Error ? error.message : "webhook_delivery_failed",
				},
			});
		}
	}

	if (
		channelAvailability.push.enabled &&
		isNotificationChannelEnabled({
			channel: "push",
			kind: params.kind,
			preferences,
		})
	) {
		try {
			const pushResult = await sendNotificationWebPush({
				userId: params.userId,
				notification: {
					id: row.id,
					kind: row.kind as NotificationKind,
					title: row.title,
					body: row.body,
					targetUrl: row.targetUrl ?? undefined,
					relatedEntityId: row.relatedEntityId ?? undefined,
					createdAt: row.createdAt.toISOString(),
				},
			});
			primaryDeliverySucceeded = pushResult.deliveredCount > 0;
		} catch (error) {
			logError({
				event: "notification.web_push.failed",
				data: {
					userId: params.userId,
					notificationId: row.id,
					error:
						error instanceof Error ? error.message : "web_push_delivery_failed",
				},
			});
		}
	}

	if (channelAvailability.hub.enabled) {
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
					type: params.kind,
					notificationKind: params.kind,
					deliveryMode: getHubNotificationDeliveryMode({
						hubChannelEnabled,
						primaryDeliverySucceeded: primaryDeliverySucceeded ?? false,
					}),
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

export async function getNotificationPreferences(params: {
	userId: string;
}): Promise<NotificationPreferences> {
	const row = await getDb().notificationPreference.findUnique({
		where: {
			userId: params.userId,
		},
		select: {
			channels: true,
		},
	});
	if (!row) {
		return createDefaultNotificationPreferences();
	}
	return parseNotificationPreferences(row.channels);
}

export async function setNotificationPreferences(params: {
	userId: string;
	preferences: NotificationPreferences;
}): Promise<NotificationPreferences> {
	const parsed = parseNotificationPreferences(params.preferences);
	const availability = await getNotificationChannelAvailability();
	const sanitized = applyNotificationChannelAvailability({
		availability,
		preferences: parsed,
	});
	await getDb().notificationPreference.upsert({
		where: {
			userId: params.userId,
		},
		create: {
			id: randomUUID(),
			userId: params.userId,
			channels: sanitized as object,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		update: {
			channels: sanitized as object,
			updatedAt: new Date(),
		},
	});
	return sanitized;
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
