import { logWarn } from "./logger.server.ts";
import type {
	NotificationKind,
	NotificationPayloadByKind,
} from "./notification.types.server.ts";

type WebhookNotification = {
	body: string;
	createdAt: string;
	id: string;
	kind: NotificationKind;
	payload: NotificationPayloadByKind[NotificationKind];
	relatedEntityId?: string;
	targetUrl?: string;
	title: string;
};

export async function sendNotificationWebhook(params: {
	userId: string;
	webhookUrl: string;
	notification: WebhookNotification;
}): Promise<void> {
	const response = await fetch(params.webhookUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-OpenGather-Event": "notification.created",
		},
		body: JSON.stringify({
			event: "notification.created",
			userId: params.userId,
			notification: params.notification,
		}),
	});

	if (!response.ok) {
		logWarn({
			event: "notification.webhook.delivery_error",
			data: {
				userId: params.userId,
				status: response.status,
				webhookUrl: params.webhookUrl,
			},
		});
	}
}
