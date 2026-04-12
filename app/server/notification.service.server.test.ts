import assert from "node:assert/strict";
import test from "node:test";
import { isNotificationChannelSupported } from "../lib/notification-preferences.ts";
import {
	createDefaultNotificationPreferences,
	parseNotificationPreferences,
} from "./notification.service.server.ts";

test("default notification preferences enable hub only for mentions and replies", () => {
	const preferences = createDefaultNotificationPreferences();

	assert.equal(preferences.matrix.mention.hub, true);
	assert.equal(preferences.matrix.reply_to_post.hub, true);
	assert.equal(preferences.matrix.agent_message.hub, false);
	assert.equal(preferences.matrix.event_reminder.hub, false);
	assert.equal(preferences.matrix.mention.push, false);
	assert.equal(preferences.matrix.mention.email, false);
	assert.equal(preferences.matrix.event_reminder.hub, false);
});

test("legacy flat notification preferences are upgraded into a per-kind matrix", () => {
	const preferences = parseNotificationPreferences({
		push: true,
		hub: false,
		webhook: true,
		email: true,
		webhookUrl: "https://hooks.example.com/opengather",
	});

	assert.equal(preferences.matrix.mention.push, true);
	assert.equal(preferences.matrix.reply_to_post.hub, false);
	assert.equal(preferences.matrix.group_membership_request.webhook, true);
	assert.equal(preferences.matrix.mention.email, false);
	assert.equal(preferences.webhookUrl, "https://hooks.example.com/opengather");
});

test("notification matrix parsing keeps supported hub cells and clears unsupported email cells", () => {
	const preferences = parseNotificationPreferences({
		matrix: {
			mention: {
				push: true,
				hub: true,
				webhook: true,
				email: true,
			},
			event_reminder: {
				push: true,
				hub: true,
				webhook: true,
				email: true,
			},
		},
	});

	assert.equal(preferences.matrix.mention.email, false);
	assert.equal(preferences.matrix.event_reminder.hub, true);
	assert.equal(preferences.matrix.event_reminder.push, true);
	assert.equal(
		isNotificationChannelSupported({
			kind: "event_reminder",
			channel: "hub",
		}),
		true,
	);
});
