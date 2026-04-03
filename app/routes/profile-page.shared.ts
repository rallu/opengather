import type {
	NotificationChannelAvailability,
	NotificationPreferences,
} from "~/server/notification.service.server";
import type {
	ProfileVisibilityMode,
	ViewerRole,
} from "~/server/permissions.server";

export type ProfileSection = "details" | "image" | "notifications" | "profile";

export type ProfileActionData =
	| {
			ok: true;
			section: ProfileSection;
	  }
	| {
			ok: false;
			error: string;
			section: ProfileSection;
	  }
	| undefined;

type ProfileAuthUser = {
	id: string;
	name: string;
};

export type ProfilePageData =
	| { status: "unauthenticated" }
	| {
			status: "not_setup";
			authUser: ProfileAuthUser;
	  }
	| { status: "error" }
	| {
			status: "ok";
			authUser: ProfileAuthUser;
			email: string;
			notificationPreferences: NotificationPreferences;
			channelAvailability: NotificationChannelAvailability;
			hasAnyPushNotificationsEnabled: boolean;
			pushConfigured: boolean;
			pushSubscriptionCount: number;
			pushVapidPublicKey: string;
			profileVisibilityOptions: Array<{
				value: ProfileVisibilityMode;
				label: string;
			}>;
			profileVisibility: ProfileVisibilityMode;
			publicProfilePath: string;
			instanceName: string;
			viewerRole: ViewerRole;
			name: string;
			image: string | null;
			imageSource:
				| "hub"
				| "local_upload"
				| "local_url"
				| "default"
				| "generated_default"
				| "none";
			summary: string | null;
	  };
