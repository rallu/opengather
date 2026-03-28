import webpush from "web-push";
import { getPushEnv, hasPushConfig } from "./env.server.ts";
import { logWarn } from "./logger.server.ts";
import type { NotificationKind } from "./notification.types.server.ts";
import {
	deleteWebPushSubscriptionsById,
	listActiveWebPushSubscriptions,
	markWebPushSubscriptionFailed,
	markWebPushSubscriptionsDelivered,
} from "./push-subscription.server.ts";

type NotificationPushPayload = {
	body: string;
	createdAt: string;
	id: string;
	kind: NotificationKind;
	relatedEntityId?: string;
	targetUrl?: string;
	title: string;
};

type WebPushSendError = Error & {
	body?: string;
	statusCode?: number;
};

let vapidConfigured = false;

function ensureWebPushConfigured(): boolean {
	if (vapidConfigured) {
		return true;
	}

	if (!hasPushConfig()) {
		return false;
	}

	const env = getPushEnv();
	webpush.setVapidDetails(
		env.VAPID_SUBJECT,
		env.VAPID_PUBLIC_KEY,
		env.VAPID_PRIVATE_KEY,
	);
	vapidConfigured = true;
	return true;
}

function buildNotificationPayload(
	notification: NotificationPushPayload,
): string {
	return JSON.stringify({
		title: notification.title,
		body: notification.body,
		tag: notification.relatedEntityId ?? notification.id,
		url: notification.targetUrl ?? "/notifications",
		data: {
			createdAt: notification.createdAt,
			kind: notification.kind,
			notificationId: notification.id,
			relatedEntityId: notification.relatedEntityId ?? null,
			targetUrl: notification.targetUrl ?? "/notifications",
		},
	});
}

export async function sendNotificationWebPush(params: {
	userId: string;
	notification: NotificationPushPayload;
}): Promise<{
	attemptedCount: number;
	deliveredCount: number;
}> {
	if (!ensureWebPushConfigured()) {
		return { attemptedCount: 0, deliveredCount: 0 };
	}

	const subscriptions = await listActiveWebPushSubscriptions({
		userId: params.userId,
	});
	if (subscriptions.length === 0) {
		return { attemptedCount: 0, deliveredCount: 0 };
	}

	const successfulIds: string[] = [];
	const expiredIds: string[] = [];
	const payload = buildNotificationPayload(params.notification);

	for (const subscription of subscriptions) {
		try {
			await webpush.sendNotification(
				{
					endpoint: subscription.endpoint,
					keys: {
						auth: subscription.authKey,
						p256dh: subscription.p256dhKey,
					},
				},
				payload,
				{
					TTL: 60 * 60,
					urgency: "normal",
				},
			);
			successfulIds.push(subscription.id);
		} catch (error) {
			const sendError = error as WebPushSendError;
			if (sendError.statusCode === 404 || sendError.statusCode === 410) {
				expiredIds.push(subscription.id);
				continue;
			}

			await markWebPushSubscriptionFailed({
				id: subscription.id,
				statusCode: sendError.statusCode,
				reason: sendError.body || sendError.message,
			});
			logWarn({
				event: "notification.web_push.delivery_error",
				data: {
					userId: params.userId,
					subscriptionId: subscription.id,
					statusCode: sendError.statusCode,
				},
			});
		}
	}

	await Promise.all([
		markWebPushSubscriptionsDelivered({ ids: successfulIds }),
		deleteWebPushSubscriptionsById({ ids: expiredIds }),
	]);

	return {
		attemptedCount: subscriptions.length,
		deliveredCount: successfulIds.length,
	};
}
