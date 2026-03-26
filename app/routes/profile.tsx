import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import { AppShell } from "~/components/app-shell";
import { ProfileImage } from "~/components/profile/profile-image";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
	getNotificationChannels,
	setNotificationChannels,
} from "~/server/notification.service.server";
import { getViewerContext } from "~/server/permissions.server";
import {
	listProfileVisibilityOptions,
	loadOwnProfile,
	parseProfileUpdateInput,
	parseProfileVisibilityMode,
	setProfileVisibility,
	updateOwnProfile,
} from "~/server/profile.service.server";
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
		await setNotificationChannels({
			userId: authUser.id,
			channels: {
				email: String(formData.get("channelEmail") ?? "") === "on",
				push: String(formData.get("channelPush") ?? "") === "on",
				webhook: String(formData.get("channelWebhook") ?? "") === "on",
				hub: String(formData.get("channelHub") ?? "") === "on",
				webhookUrl: String(formData.get("webhookUrl") ?? "").trim(),
			},
		});
		return { ok: true as const, section: "notifications" as const };
	}

	const parsed = parseProfileUpdateInput({
		name: String(formData.get("name") ?? ""),
		image: String(formData.get("image") ?? ""),
		summary: String(formData.get("summary") ?? ""),
	});
	if (!parsed.ok) {
		return {
			ok: false as const,
			error: parsed.error,
			section: "details" as const,
		};
	}

	await updateOwnProfile({
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

		const [profile, notificationChannels] = await Promise.all([
			loadOwnProfile({
				userId: authUser.id,
				hubUserId: authUser.hubUserId,
				instanceId: setup.instance.id,
				instanceName: setup.instance.name,
				viewerRole,
			}),
			getNotificationChannels({ userId: authUser.id }),
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
			notificationChannels,
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

	return (
		<AppShell
			authUser={data.authUser}
			title="Profile"
			showServerSettings={data.viewerRole === "admin"}
		>
			<section className="rounded-md border border-border p-4 text-sm">
				<div className="flex items-center gap-3">
					<ProfileImage
						src={data.image ?? undefined}
						alt={`${data.name} profile image`}
						fallback={fallback}
						size="lg"
					/>
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
					<Input
						name="image"
						defaultValue={data.image ?? ""}
						placeholder="Image URL"
						data-testid="profile-image-input"
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
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							name="channelHub"
							defaultChecked={Boolean(data.notificationChannels.hub)}
						/>
						Hub
					</label>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							name="channelEmail"
							defaultChecked={Boolean(data.notificationChannels.email)}
						/>
						Email
					</label>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							name="channelPush"
							defaultChecked={Boolean(data.notificationChannels.push)}
						/>
						Push
					</label>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							name="channelWebhook"
							defaultChecked={Boolean(data.notificationChannels.webhook)}
						/>
						Webhook
					</label>
					<div className="space-y-2">
						<label className="text-sm font-medium" htmlFor="webhook-url">
							Webhook URL
						</label>
						<input
							id="webhook-url"
							name="webhookUrl"
							defaultValue={data.notificationChannels.webhookUrl ?? ""}
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
