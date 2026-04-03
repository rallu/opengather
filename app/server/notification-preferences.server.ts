import {
	isNotificationChannelSupported,
	type NotificationChannel,
	type NotificationKind,
	notificationChannels,
	notificationKinds,
} from "../lib/notification-preferences.ts";
import { getServerConfig } from "./config.service.server.ts";
import { hasPushConfig } from "./env.server.ts";

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
