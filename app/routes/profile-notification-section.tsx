import { Form } from "react-router";
import { PushDeviceControls } from "~/components/profile/push-device-controls";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
	isNotificationChannelSupported,
	notificationChannelMeta,
	notificationChannels,
	notificationKindMeta,
	notificationKinds,
} from "~/lib/notification-preferences";
import type { ProfileActionData, ProfilePageData } from "./profile-page.shared";

export function ProfileNotificationSection(params: {
	actionData: ProfileActionData;
	data: Extract<ProfilePageData, { status: "ok" }>;
}) {
	const { actionData, data } = params;

	return (
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
	);
}
