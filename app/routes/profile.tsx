import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import { AppShell } from "~/components/app-shell";
import { ProfileImage } from "~/components/profile/profile-image";
import { PushDeviceControls } from "~/components/profile/push-device-controls";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { Icon } from "~/components/ui/icon";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
	isNotificationChannelSupported,
	notificationChannelMeta,
	notificationChannels,
	notificationKindMeta,
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

export async function action({ request }: ActionFunctionArgs) {
	const authUser = await getAuthUserFromRequest({ request });
	if (!authUser) {
		return {
			ok: false as const,
			error: "Sign in required.",
			section: "details",
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

	if (data.status === "unauthenticated") {
		return (
			<AppShell authUser={null} title="Profile">
				<section className="space-y-3 rounded-md border border-border p-4">
					<p className="text-sm text-muted-foreground">
						Sign in to manage your profile settings.
					</p>
					<div className="flex gap-3">
						<Button asChild>
							<Link to="/login">Sign In</Link>
						</Button>
						<Button variant="outline" asChild>
							<Link to="/register">Register</Link>
						</Button>
					</div>
				</section>
			</AppShell>
		);
	}

	if (data.status === "not_setup") {
		return (
			<AppShell
				authUser={data.authUser}
				title="Profile"
				showServerSettings={false}
			>
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Server setup is not completed yet.
				</div>
			</AppShell>
		);
	}

	if (data.status === "error") {
		return (
			<AppShell authUser={null} title="Profile">
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Failed to load profile settings.
				</div>
			</AppShell>
		);
	}

	const fallback = data.name.trim().slice(0, 1).toUpperCase() || "?";
	const imageSourceText =
		data.imageSource === "local_upload"
			? "Using an uploaded image stored on this instance."
			: data.imageSource === "local_url"
				? "Using an image override saved on this instance."
				: data.imageSource === "hub"
					? "Using the image from the linked hub account until you upload a local override."
					: data.imageSource === "default"
						? "Using your current account image."
						: "No profile image is currently set.";

	return (
		<AppShell
			authUser={data.authUser}
			title="Profile"
			showServerSettings={data.viewerRole === "admin"}
		>
			<section className="rounded-md border border-border p-4 text-sm">
				<div className="flex items-center gap-3">
					<Dialog>
						<div className="relative">
							<ProfileImage
								src={data.image ?? undefined}
								alt={`${data.name} profile image`}
								fallback={fallback}
								size="lg"
							/>
							<DialogTrigger
								className="absolute -right-1 -top-1 h-8 w-8 rounded-full border border-border bg-background p-0 shadow-sm"
								data-testid="profile-image-dialog-trigger"
								aria-label="Change profile image"
							>
								<Icon name="imagePlus" size={16} />
							</DialogTrigger>
						</div>
						<DialogContent data-testid="profile-image-dialog">
							<DialogHeader>
								<DialogTitle>Change image</DialogTitle>
								<DialogDescription>{imageSourceText}</DialogDescription>
							</DialogHeader>
							<DialogBody>
								<div className="flex items-start gap-4">
									<ProfileImage
										src={data.image ?? undefined}
										alt={`${data.name} profile image`}
										fallback={fallback}
										size="lg"
									/>
									<div className="min-w-0 flex-1 space-y-3">
										{actionData?.section === "image" && actionData.ok ? (
											<p
												className="text-sm text-emerald-700"
												data-testid="profile-image-save-success"
											>
												Saved.
											</p>
										) : null}
										{actionData?.section === "image" &&
										actionData.ok === false ? (
											<p
												className="text-sm text-destructive"
												data-testid="profile-image-save-error"
											>
												{actionData.error}
											</p>
										) : null}
										<Form
											method="post"
											encType="multipart/form-data"
											className="space-y-3"
										>
											<input
												type="hidden"
												name="_action"
												value="upload-profile-image"
											/>
											<input
												type="file"
												name="imageFile"
												accept="image/avif,image/jpeg,image/png,image/webp"
												data-testid="profile-image-upload-input"
												className="block w-full text-sm"
											/>
											<Button
												type="submit"
												variant="outline"
												data-testid="profile-image-upload-button"
											>
												Upload image
											</Button>
										</Form>
										<Form method="post">
											<input
												type="hidden"
												name="_action"
												value="clear-profile-image-override"
											/>
											<Button
												type="submit"
												variant="outline"
												data-testid="profile-image-clear-button"
											>
												Clear image
											</Button>
										</Form>
									</div>
								</div>
							</DialogBody>
						</DialogContent>
					</Dialog>
					<div className="min-w-0 space-y-1">
						<p className="truncate font-medium">{data.name}</p>
						<p className="text-muted-foreground">
							{data.viewerRole} • {data.instanceName}
						</p>
					</div>
				</div>
				{data.summary ? <p className="mt-3 text-sm">{data.summary}</p> : null}
				<p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
					Profile visibility: {data.profileVisibility}
				</p>
			</section>

			<section className="space-y-3 rounded-md border border-border p-4">
				<div className="space-y-2 text-sm">
					<p>
						<span className="text-muted-foreground">Name:</span> {data.name}
					</p>
					<p>
						<span className="text-muted-foreground">Email:</span> {data.email}
					</p>
					<p>
						<span className="text-muted-foreground">Current role:</span>{" "}
						{data.viewerRole}
					</p>
				</div>
			</section>

			<section className="space-y-3 rounded-md border border-border p-4">
				<div className="flex flex-wrap gap-3">
					<Button variant="outline" asChild>
						<Link to={data.publicProfilePath}>Open public profile</Link>
					</Button>
					{data.viewerRole === "admin" ? (
						<>
							<Button variant="outline" asChild>
								<Link to="/server-settings">Server Settings</Link>
							</Button>
							<Button variant="outline" asChild>
								<Link to="/audit-logs">Audit Logs</Link>
							</Button>
						</>
					) : null}
				</div>
			</section>

			<section className="rounded-md border border-border p-4">
				<h2 className="text-base font-semibold">Profile details</h2>
				{actionData?.section === "details" && actionData.ok ? (
					<p
						className="mt-3 text-sm text-emerald-700"
						data-testid="profile-save-success"
					>
						Saved.
					</p>
				) : null}
				{actionData?.section === "details" && actionData.ok === false ? (
					<p
						className="mt-3 text-sm text-destructive"
						data-testid="profile-save-error"
					>
						{actionData.error}
					</p>
				) : null}
				<Form method="post" className="mt-3 space-y-3">
					<input type="hidden" name="_action" value="save-profile-details" />
					<Input
						name="name"
						defaultValue={data.name}
						maxLength={80}
						placeholder="Name"
						data-testid="profile-name-input"
					/>
					<Textarea
						name="summary"
						defaultValue={data.summary ?? ""}
						maxLength={300}
						placeholder="Short description (max 300 characters)"
						data-testid="profile-summary-input"
					/>
					<Button
						type="submit"
						variant="outline"
						data-testid="profile-save-button"
					>
						Save profile details
					</Button>
				</Form>
			</section>

			<section className="space-y-3 rounded-md border border-border p-4">
				<h2 className="text-base font-semibold">Profile privacy</h2>
				{actionData?.section === "profile" ? (
					<p
						className="text-sm text-emerald-700"
						data-testid="settings-profile-saved"
					>
						Saved.
					</p>
				) : null}
				<Form method="post" className="space-y-3">
					<input type="hidden" name="_action" value="save-profile-visibility" />
					<div className="space-y-2">
						<label className="text-sm font-medium" htmlFor="profile-visibility">
							Who can view your profile activity
						</label>
						{data.profileVisibility !== "public" &&
						data.profileVisibilityOptions.every(
							(option) => option.value !== "public",
						) ? (
							<p className="text-sm text-muted-foreground">
								Public profiles are unavailable because this instance is not
								public.
							</p>
						) : null}
						<select
							id="profile-visibility"
							name="profileVisibility"
							defaultValue={data.profileVisibility}
							data-testid="settings-profile-visibility"
							className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						>
							{data.profileVisibilityOptions.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</div>
					<Button
						type="submit"
						variant="outline"
						data-testid="settings-profile-save"
					>
						Save profile privacy
					</Button>
				</Form>
			</section>

			<section className="space-y-3 rounded-md border border-border p-4">
				<h2 className="text-base font-semibold">Notification channels</h2>
				{actionData?.section === "notifications" ? (
					<p className="text-sm text-emerald-700">Saved.</p>
				) : null}
				<Form method="post" className="space-y-3">
					<input type="hidden" name="_action" value="save-notifications" />
					<div className="overflow-x-auto rounded-md border border-border/60">
						<table className="min-w-[44rem] w-full border-collapse text-sm">
							<thead className="bg-muted/40">
								<tr>
									<th className="border-b border-border/60 px-3 py-2 text-left font-medium">
										Notification type
									</th>
									{notificationChannels.map((channel) => (
										<th
											key={channel}
											className="border-b border-border/60 px-3 py-2 text-center font-medium"
										>
											<div>{notificationChannelMeta[channel].label}</div>
											{!data.channelAvailability[channel].enabled &&
											data.channelAvailability[channel].reason ? (
												<div className="mt-1 text-[11px] font-normal text-muted-foreground">
													Unavailable
												</div>
											) : null}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{notificationKinds.map((kind) => (
									<tr
										key={kind}
										className="border-b border-border/40 last:border-b-0"
									>
										<td className="px-3 py-3 align-top">
											<div className="font-medium">
												{notificationKindMeta[kind].label}
											</div>
											<div className="text-xs text-muted-foreground">
												{notificationKindMeta[kind].description}
											</div>
										</td>
										{notificationChannels.map((channel) => {
											const enabled =
												data.channelAvailability[channel].enabled &&
												isNotificationChannelSupported({
													kind,
													channel,
												});

											return (
												<td
													key={`${kind}-${channel}`}
													className="px-3 py-3 text-center align-middle"
												>
													<Checkbox
														name={`notification:${kind}:${channel}`}
														defaultChecked={
															enabled &&
															Boolean(
																data.notificationPreferences.matrix[kind][
																	channel
																],
															)
														}
														disabled={!enabled}
														aria-label={`${notificationKindMeta[kind].label} via ${notificationChannelMeta[channel].label}`}
														className="justify-center"
													/>
												</td>
											);
										})}
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<div className="space-y-1 text-xs text-muted-foreground">
						<p>
							Push also requires at least one subscribed browser/device below.
						</p>
						<p>
							Hub always keeps a synced copy for linked Hub accounts and only
							delivers directly when another primary channel did not reach you.
						</p>
						{notificationChannels
							.filter((channel) => !data.channelAvailability[channel].enabled)
							.map((channel) =>
								data.channelAvailability[channel].reason ? (
									<p key={channel}>
										{notificationChannelMeta[channel].label}:{" "}
										{data.channelAvailability[channel].reason}
									</p>
								) : null,
							)}
					</div>
					<div className="rounded-md border border-border/60 bg-muted/30 p-3">
						<PushDeviceControls
							pushChannelEnabled={Boolean(data.hasAnyPushNotificationsEnabled)}
							pushConfigured={Boolean(data.pushConfigured)}
							pushSubscriptionCount={data.pushSubscriptionCount}
							vapidPublicKey={data.pushVapidPublicKey}
						/>
					</div>
					<div className="space-y-2">
						<label className="text-sm font-medium" htmlFor="webhook-url">
							Webhook URL
						</label>
						<input
							id="webhook-url"
							name="webhookUrl"
							defaultValue={data.notificationPreferences.webhookUrl ?? ""}
							disabled={!data.channelAvailability.webhook.enabled}
							className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						/>
					</div>
					<Button type="submit" variant="outline">
						Save notification channels
					</Button>
				</Form>
			</section>
		</AppShell>
	);
}
