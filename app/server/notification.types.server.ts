export const notificationKinds = [
	"reply_to_post",
	"mention",
	"event_reminder",
	"instance_membership_request",
	"group_membership_request",
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
	instance_membership_request: {
		instanceId: string;
		requesterUserId: string;
		requestKey: string;
	};
	group_membership_request: {
		groupId: string;
		requesterUserId: string;
		requestKey: string;
	};
};
