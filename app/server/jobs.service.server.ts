import { getDb } from "./db.server.ts";
import { pushHubNotification } from "./hub.service.server.ts";

function toErrorString(params: { error: unknown }): string {
	if (params.error instanceof Error) {
		return params.error.message;
	}
	return "Unknown error";
}

function nextAttemptDate(params: { attempts: number }): Date {
	const backoffMinutes = Math.min(60, 2 ** Math.max(0, params.attempts - 1));
	return new Date(Date.now() + backoffMinutes * 60 * 1000);
}

function asNotificationType(params: {
	value: string;
}): "mention" | "reply" | null {
	if (params.value === "mention" || params.value === "reply") {
		return params.value;
	}
	return null;
}

export async function processNotificationOutbox(params: {
	limit: number;
}): Promise<number> {
	const db = getDb();
	const now = new Date();
	const items = await db.notificationOutbox.findMany({
		where: {
			status: { in: ["pending", "failed"] },
			nextAttemptAt: { lte: now },
		},
		orderBy: { createdAt: "asc" },
		take: params.limit,
	});

	let processed = 0;
	for (const item of items) {
		if (item.attempts >= item.maxAttempts) {
			continue;
		}
		const type = asNotificationType({ value: item.type });
		if (!type) {
			await db.notificationOutbox.update({
				where: { id: item.id },
				data: {
					status: "failed",
					attempts: item.attempts + 1,
					lastError: `Unsupported notification type: ${item.type}`,
					updatedAt: new Date(),
				},
			});
			processed += 1;
			continue;
		}

		try {
			await pushHubNotification({
				recipientHubUserId: item.recipientHubUserId,
				type,
				title: item.title,
				body: item.body,
				targetUrl: item.targetUrl ?? undefined,
			});

			await db.notificationOutbox.update({
				where: { id: item.id },
				data: {
					status: "sent",
					attempts: item.attempts + 1,
					lastError: null,
					updatedAt: new Date(),
				},
			});
			processed += 1;
		} catch (error) {
			const attempts = item.attempts + 1;
			await db.notificationOutbox.update({
				where: { id: item.id },
				data: {
					status: attempts >= item.maxAttempts ? "failed" : "pending",
					attempts,
					lastError: toErrorString({ error }),
					nextAttemptAt: nextAttemptDate({ attempts }),
					updatedAt: new Date(),
				},
			});
			processed += 1;
		}
	}

	return processed;
}
