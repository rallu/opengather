export const notificationKinds = [
	"reply_to_post",
	"mention",
	"agent_message",
	"event_reminder",
	"instance_membership_request",
	"group_membership_request",
] as const;

export type NotificationKind = (typeof notificationKinds)[number];

export const notificationChannels = [
	"push",
	"hub",
	"webhook",
	"email",
] as const;

export type NotificationChannel = (typeof notificationChannels)[number];

export const notificationKindMeta: Record<
	NotificationKind,
	{ description: string; label: string }
> = {
	reply_to_post: {
		label: "Replies",
		description: "Someone replies to one of your posts.",
	},
	mention: {
		label: "Mentions",
		description: "Someone mentions you in a post.",
	},
	agent_message: {
		label: "Agent messages",
		description: "A local agent sends you a direct notification.",
	},
	event_reminder: {
		label: "Event reminders",
		description: "A followed event is about to start.",
	},
	instance_membership_request: {
		label: "Server approvals",
		description: "A new server access approval request needs attention.",
	},
	group_membership_request: {
		label: "Group approvals",
		description: "A new group access approval request needs attention.",
	},
};

export const notificationChannelMeta: Record<
	NotificationChannel,
	{ description: string; label: string }
> = {
	push: {
		label: "Push",
		description: "Browser notifications on subscribed devices.",
	},
	hub: {
		label: "Hub",
		description:
			"Sync notifications to your linked OpenGather Hub account and allow Hub delivery when another direct channel did not reach you first.",
	},
	webhook: {
		label: "Webhook",
		description:
			"POST the notification payload to your configured webhook URL.",
	},
	email: {
		label: "Email",
		description: "Email delivery is not implemented yet.",
	},
};

export function isNotificationChannelSupported(params: {
	channel: NotificationChannel;
	kind: NotificationKind;
}): boolean {
	if (params.channel === "email") {
		return false;
	}
	return true;
}
