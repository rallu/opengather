import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useLoaderData, useNavigation } from "react-router";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import {
	listNotifications,
	markAllNotificationsRead,
	markNotificationRead,
} from "~/server/notification.service.server";
import { getAuthUserFromRequest } from "~/server/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
	const authUser = await getAuthUserFromRequest({ request });
	if (!authUser) {
		return { status: "unauthenticated" as const };
	}

	const notifications = await listNotifications({
		userId: authUser.id,
		onlyUnread: new URL(request.url).searchParams.get("filter") === "unread",
		limit: 100,
	});

	return {
		status: "ok" as const,
		authUser,
		notifications,
	};
}

export async function action({ request }: ActionFunctionArgs) {
	const authUser = await getAuthUserFromRequest({ request });
	if (!authUser) {
		return { ok: false, error: "Unauthorized" };
	}

	const formData = await request.formData();
	const actionType = String(formData.get("_action") ?? "");
	if (actionType === "mark_one") {
		const notificationId = String(formData.get("notificationId") ?? "");
		if (notificationId) {
			await markNotificationRead({
				userId: authUser.id,
				notificationId,
			});
		}
		return { ok: true };
	}

	if (actionType === "mark_all") {
		await markAllNotificationsRead({ userId: authUser.id });
		return { ok: true };
	}

	return { ok: false, error: "Unsupported action" };
}

export default function NotificationsPage() {
	const data = useLoaderData<typeof loader>();
	const navigation = useNavigation();
	const loading = navigation.state === "submitting";

	if (data.status === "unauthenticated") {
		return (
			<AppShell authUser={null} title="Notifications">
				<div className="rounded-md border border-border p-4 text-sm">
					Sign in to view notifications.
					<div className="mt-3 flex gap-2">
						<Button asChild>
							<Link to="/login">Sign In</Link>
						</Button>
						<Button asChild variant="outline">
							<Link to="/register">Register</Link>
						</Button>
					</div>
				</div>
			</AppShell>
		);
	}

	return (
		<AppShell authUser={data.authUser} title="Notifications">
			<div className="flex items-center justify-between">
				<div className="text-sm text-muted-foreground">
					Total: {data.notifications.length}
				</div>
				<Form method="post">
					<input type="hidden" name="_action" value="mark_all" />
					<Button type="submit" variant="outline" disabled={loading}>
						Mark all as read
					</Button>
				</Form>
			</div>

			{data.notifications.length === 0 ? (
				<div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
					No notifications.
				</div>
			) : (
				<ul className="space-y-3">
					{data.notifications.map((notification) => (
						<li key={notification.id} className="rounded-md border border-border p-4">
							<div className="flex items-start justify-between gap-3">
								<div className="space-y-1">
									<p className="text-xs uppercase tracking-wide text-muted-foreground">
										{notification.kind}
									</p>
									<p className="font-medium">{notification.title}</p>
									<p className="text-sm text-muted-foreground">{notification.body}</p>
									{notification.targetUrl ? (
										<Link className="text-sm underline" to={notification.targetUrl}>
											Open
										</Link>
									) : null}
								</div>
								<div className="flex flex-col items-end gap-2">
									<p className="text-xs text-muted-foreground">
										{new Date(notification.createdAt).toLocaleString()}
									</p>
									{!notification.readAt ? (
										<Form method="post">
											<input type="hidden" name="_action" value="mark_one" />
											<input
												type="hidden"
												name="notificationId"
												value={notification.id}
											/>
											<Button type="submit" size="sm" variant="outline" disabled={loading}>
												Mark read
											</Button>
										</Form>
									) : (
										<p className="text-xs text-emerald-700">Read</p>
									)}
								</div>
							</div>
						</li>
					))}
				</ul>
			)}
		</AppShell>
	);
}
