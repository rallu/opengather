export const notificationKinds = [
	"reply_to_post",
	"mention",
	"event_reminder",
] as const;

export type NotificationKind = (typeof notificationKinds)[number];

export type NotificationPayloadByKind = {
	reply_to_post: {
		actorUserId: string;
		postId: string;
		parentPostId: string;
	};
	mention: {
		actorUserId: string;
		postId: string;
	};
	event_reminder: {
		eventId: string;
		startsAt: string;
	};
};
