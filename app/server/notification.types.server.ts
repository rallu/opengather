export {
	type NotificationKind,
	notificationKinds,
} from "../lib/notification-preferences.ts";

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
	agent_message: {
		agentId: string;
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
