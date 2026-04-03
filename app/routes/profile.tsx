import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData } from "react-router";
import {
	notificationChannels,
	notificationKinds,
} from "~/lib/notification-preferences";
import { getPushEnv, hasPushConfig } from "~/server/env.server.ts";
import {
	cleanupParsedMultipartForm,
	parseMultipartForm,
} from "~/server/multipart-form.server";
import {
	applyNotificationChannelAvailability,
	getNotificationChannelAvailability,
	getNotificationPreferences,
	hasAnyNotificationChannelEnabled,
	type NotificationChannelMatrix,
	setNotificationPreferences,
} from "~/server/notification.service.server";
import { getViewerContext } from "~/server/permissions.server";
import { MAX_IMAGE_BYTES } from "~/server/post-assets.server";
import {
	listProfileVisibilityOptions,
	loadOwnProfile,
	parseProfileDetailsInput,
	parseProfileVisibilityMode,
	setProfileImageOverride,
	setProfileVisibility,
	updateOwnProfileDetails,
} from "~/server/profile.service.server";
import {
	deleteUploadedProfileImage,
	saveUploadedProfileImage,
} from "~/server/profile-image.server";
import { countWebPushSubscriptions } from "~/server/push-subscription.server.ts";
import { getAuthUserFromRequest } from "~/server/session.server";
import { ProfilePageView } from "./profile-page";

export async function action({ request }: ActionFunctionArgs) {
	const authUser = await getAuthUserFromRequest({ request });
	if (!authUser) {
		return {
			ok: false as const,
			error: "Sign in required.",
			section: "details" as const,
		};
	}

	const contentType = request.headers.get("content-type") ?? "";
	if (contentType.toLowerCase().includes("multipart/form-data")) {
		const parsed = await parseMultipartForm({
			request,
			maxFiles: 1,
			maxFileSizeBytes: MAX_IMAGE_BYTES,
		});
		try {
			const actionType = (parsed.fields.get("_action") ?? "").trim();
			if (actionType !== "upload-profile-image") {
				return {
					ok: false as const,
					error: "Unsupported profile image upload request.",
					section: "image" as const,
				};
			}

			const upload = parsed.files.find(
				(file) => file.fieldName === "imageFile",
			);
			if (!upload) {
				return {
					ok: false as const,
					error: "Choose an image file to upload.",
					section: "image" as const,
				};
			}

			const imageOverride = await saveUploadedProfileImage({
				userId: authUser.id,
				upload,
			});
			await setProfileImageOverride({
				userId: authUser.id,
				imageOverride,
			});
			return { ok: true as const, section: "image" as const };
		} catch (error) {
			return {
				ok: false as const,
				error:
					error instanceof Error
						? error.message
						: "Failed to upload profile image.",
				section: "image" as const,
			};
		} finally {
			await cleanupParsedMultipartForm(parsed);
		}
	}

	const formData = await request.formData();
	const actionType = String(formData.get("_action") ?? "save-profile-details");

	if (actionType === "save-profile-visibility") {
		await setProfileVisibility({
			userId: authUser.id,
			visibilityMode: parseProfileVisibilityMode(
				String(formData.get("profileVisibility") ?? "public"),
			),
		});
		return { ok: true as const, section: "profile" as const };
	}

	if (actionType === "save-notifications") {
		const matrix = Object.fromEntries(
			notificationKinds.map((kind) => [
				kind,
				Object.fromEntries(
					notificationChannels.map((channel) => [
						channel,
						String(formData.get(`notification:${kind}:${channel}`) ?? "") ===
							"on",
					]),
				),
			]),
		) as NotificationChannelMatrix;
		const channelAvailability = await getNotificationChannelAvailability();

		await setNotificationPreferences({
			userId: authUser.id,
			preferences: applyNotificationChannelAvailability({
				availability: channelAvailability,
				preferences: {
					matrix,
					webhookUrl: String(formData.get("webhookUrl") ?? "").trim(),
				},
			}),
		});
		return { ok: true as const, section: "notifications" as const };
	}

	if (actionType === "clear-profile-image-override") {
		await setProfileImageOverride({
			userId: authUser.id,
			imageOverride: null,
		});
		await deleteUploadedProfileImage({ userId: authUser.id });
		return { ok: true as const, section: "image" as const };
	}

	const parsed = parseProfileDetailsInput({
		name: String(formData.get("name") ?? ""),
		summary: String(formData.get("summary") ?? ""),
	});
	if (!parsed.ok) {
		return {
			ok: false as const,
			error: parsed.error,
			section: "details" as const,
		};
	}

	await updateOwnProfileDetails({
		userId: authUser.id,
		...parsed.value,
	});

	return { ok: true as const, section: "details" as const };
}

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		const { authUser, setup, viewerRole } = await getViewerContext({ request });
		if (!authUser) {
			return { status: "unauthenticated" as const };
		}
		if (!setup.isSetup || !setup.instance) {
			return { status: "not_setup" as const, authUser };
		}

		const pushConfigured = hasPushConfig();
		const [
			profile,
			notificationPreferences,
			pushSubscriptionCount,
			channelAvailability,
		] = await Promise.all([
			loadOwnProfile({
				userId: authUser.id,
				hubUserId: authUser.hubUserId,
				instanceId: setup.instance.id,
				instanceName: setup.instance.name,
				viewerRole,
			}),
			getNotificationPreferences({ userId: authUser.id }),
			countWebPushSubscriptions({ userId: authUser.id }),
			getNotificationChannelAvailability(),
		]);
		if (profile.status !== "ok") {
			return { status: "error" as const };
		}

		const { status: _profileStatus, ...profileData } = profile;

		return {
			status: "ok" as const,
			authUser: {
				...authUser,
				name: profileData.name,
			},
			email: authUser.email,
			notificationPreferences,
			channelAvailability,
			hasAnyPushNotificationsEnabled: hasAnyNotificationChannelEnabled({
				channel: "push",
				preferences: notificationPreferences,
			}),
			pushConfigured,
			pushSubscriptionCount,
			pushVapidPublicKey: pushConfigured ? getPushEnv().VAPID_PUBLIC_KEY : "",
			profileVisibilityOptions: listProfileVisibilityOptions({
				instanceVisibilityMode: setup.instance.visibilityMode,
			}),
			...profileData,
		};
	} catch {
		return { status: "error" as const };
	}
}

export default function ProfilePage() {
	const data = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	return <ProfilePageView actionData={actionData} data={data} />;
}
