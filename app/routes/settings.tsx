import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import { getDb } from "~/server/db.server";
import {
	getNotificationChannels,
	setNotificationChannels,
} from "~/server/notification.service.server";
import { getAuthUserFromRequest } from "~/server/session.server";
import { getSetupStatus } from "~/server/setup.service.server";

export async function action({ request }: ActionFunctionArgs) {
	const authUser = await getAuthUserFromRequest({ request });
	if (!authUser) {
		return { ok: false, error: "Sign in required." };
	}

	const formData = await request.formData();
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

	return { ok: true };
}

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		const authUser = await getAuthUserFromRequest({ request });
		const setup = await getSetupStatus();

		let viewerRole: "guest" | "member" | "moderator" | "admin" = "guest";
		if (authUser && setup.isSetup && setup.instance) {
			const membership = await getDb().instanceMembership.findFirst({
				where: {
					instanceId: setup.instance.id,
					principalId: authUser.id,
					principalType: "user",
				},
				select: { role: true, approvalStatus: true },
			});
			if (membership && membership.approvalStatus === "approved") {
				viewerRole = membership.role as "member" | "moderator" | "admin";
			}
		}

		return {
			authUser,
			viewerRole,
			setup,
			notificationChannels: authUser
				? await getNotificationChannels({ userId: authUser.id })
				: null,
		};
	} catch {
		return {
			authUser: null,
			viewerRole: "guest" as const,
			setup: { isSetup: false },
			notificationChannels: null,
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
							{data.viewerRole === "admin" ? (
								<Button variant="outline" asChild>
									<Link to="/server-settings">Server Settings</Link>
								</Button>
							) : null}
						</div>
					</section>

					<section className="space-y-3 rounded-md border border-border p-4">
						<h2 className="text-base font-semibold">Notification channels</h2>
						{actionData && "ok" in actionData ? (
							<p className="text-sm text-emerald-700">Saved.</p>
						) : null}
						<Form method="post" className="space-y-3">
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
