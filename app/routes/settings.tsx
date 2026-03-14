import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import {
	getNotificationChannels,
	setNotificationChannels,
} from "~/server/notification.service.server";
import { getViewerContext } from "~/server/permissions.server";
import {
	getProfileVisibility,
	parseProfileVisibilityMode,
	setProfileVisibility,
} from "~/server/profile.service.server";
import { getAuthUserFromRequest } from "~/server/session.server";

export async function action({ request }: ActionFunctionArgs) {
	const authUser = await getAuthUserFromRequest({ request });
	if (!authUser) {
		return { ok: false, error: "Sign in required." };
	}

	const formData = await request.formData();
	const actionType = String(formData.get("_action") ?? "save-notifications");
	if (actionType === "save-profile-visibility") {
		await setProfileVisibility({
			userId: authUser.id,
			visibilityMode: parseProfileVisibilityMode(
				String(formData.get("profileVisibility") ?? "public"),
			),
		});
		return { ok: true, section: "profile" as const };
	}

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

	return { ok: true, section: "notifications" as const };
}

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		const { authUser, setup, viewerRole } = await getViewerContext({ request });

		return {
			authUser,
			viewerRole,
			setup,
			notificationChannels: authUser
				? await getNotificationChannels({ userId: authUser.id })
				: null,
			profileVisibility: authUser
				? await getProfileVisibility({ userId: authUser.id })
				: "public",
		};
	} catch {
		return {
			authUser: null,
			viewerRole: "guest" as const,
			setup: { isSetup: false },
			notificationChannels: null,
			profileVisibility: "public" as const,
		};
	}
}

export default function SettingsPage() {
	const data = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();

	return (
		<AppShell
			authUser={data.authUser}
			title="Settings"
			showServerSettings={data.viewerRole === "admin"}
		>
			{data.authUser ? (
				<>
					<section className="space-y-3 rounded-md border border-border p-4">
						<div className="space-y-2 text-sm">
							<p>
								<span className="text-muted-foreground">Name:</span>{" "}
								{data.authUser.name}
							</p>
							<p>
								<span className="text-muted-foreground">Email:</span>{" "}
								{data.authUser.email}
							</p>
							<p>
								<span className="text-muted-foreground">Current role:</span>{" "}
								{data.viewerRole}
							</p>
						</div>
					</section>

					<section className="space-y-3 rounded-md border border-border p-4">
						<div className="flex gap-3">
							<Button variant="outline" asChild>
								<Link to="/profile">Open Profile</Link>
							</Button>
							<Button variant="outline" asChild>
								<Link to={`/profiles/${data.authUser.id}`}>
									Open Public Profile
								</Link>
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

					<section className="space-y-3 rounded-md border border-border p-4">
						<h2 className="text-base font-semibold">Profile privacy</h2>
						{actionData && actionData.section === "profile" ? (
							<p
								className="text-sm text-emerald-700"
								data-testid="settings-profile-saved"
							>
								Saved.
							</p>
						) : null}
						<Form method="post" className="space-y-3">
							<input
								type="hidden"
								name="_action"
								value="save-profile-visibility"
							/>
							<div className="space-y-2">
								<label
									className="text-sm font-medium"
									htmlFor="profile-visibility"
								>
									Who can view your profile activity
								</label>
								<select
									id="profile-visibility"
									name="profileVisibility"
									defaultValue={data.profileVisibility}
									data-testid="settings-profile-visibility"
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								>
									<option value="public">Public</option>
									<option value="instance_members">Instance members</option>
									<option value="private">Private</option>
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
						{actionData && actionData.section === "notifications" ? (
							<p className="text-sm text-emerald-700">Saved.</p>
						) : null}
						<Form method="post" className="space-y-3">
							<input type="hidden" name="_action" value="save-notifications" />
							<label className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									name="channelHub"
									defaultChecked={Boolean(data.notificationChannels?.hub)}
								/>
								Hub
							</label>
							<label className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									name="channelEmail"
									defaultChecked={Boolean(data.notificationChannels?.email)}
								/>
								Email
							</label>
							<label className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									name="channelPush"
									defaultChecked={Boolean(data.notificationChannels?.push)}
								/>
								Push
							</label>
							<label className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									name="channelWebhook"
									defaultChecked={Boolean(data.notificationChannels?.webhook)}
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
									defaultValue={data.notificationChannels?.webhookUrl ?? ""}
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								/>
							</div>
							<Button type="submit" variant="outline">
								Save notification channels
							</Button>
						</Form>
					</section>
				</>
			) : (
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
			)}
		</AppShell>
	);
}
