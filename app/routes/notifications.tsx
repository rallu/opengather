import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useLoaderData, useNavigation } from "react-router";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import { Container } from "~/components/ui/container";
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

	const unreadCount = data.notifications.filter(
		(notification) => !notification.readAt,
	).length;
	const notificationsAside = (
		<>
			<Container className="rounded-lg border-border/50 bg-card">
				<div className="grid grid-cols-2 gap-3 p-5 text-sm">
					<div className="rounded-xl bg-muted/50 p-3">
						<p className="text-sm text-muted-foreground">Total</p>
						<p className="mt-2 text-2xl font-semibold text-foreground">
							{data.notifications.length}
						</p>
					</div>
					<div className="rounded-xl bg-muted/50 p-3">
						<p className="text-sm text-muted-foreground">Unread</p>
						<p className="mt-2 text-2xl font-semibold text-foreground">
							{unreadCount}
						</p>
					</div>
					<Form method="post" className="col-span-2">
						<input type="hidden" name="_action" value="mark_all" />
						<Button
							type="submit"
							variant="outline"
							disabled={loading || unreadCount === 0}
							className="w-full rounded-full"
						>
							Mark all as read
						</Button>
					</Form>
				</div>
			</Container>
			<Container className="rounded-lg border-border/50 bg-card">
				<div className="space-y-2 p-5 text-sm text-muted-foreground">
					<p>Open the notification target only when you need context.</p>
					<p>Mark items read from the list once the action is complete.</p>
				</div>
			</Container>
		</>
	);

	return (
		<AppShell authUser={data.authUser} aside={notificationsAside}>
			{data.notifications.length === 0 ? (
				<div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
					No notifications.
				</div>
			) : (
				<ul className="space-y-3">
					{data.notifications.map((notification) => (
						<li
							key={notification.id}
							className="rounded-md border border-border p-4"
							data-testid={`notification-item-${notification.relatedEntityId ?? notification.id}`}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="space-y-1">
									<p className="text-xs uppercase tracking-wide text-muted-foreground">
										{notification.kind}
									</p>
									<p className="font-medium">{notification.title}</p>
									<p className="text-sm text-muted-foreground">
										{notification.body}
									</p>
									{notification.targetUrl ? (
										<Link
											className="text-sm underline"
											to={notification.targetUrl}
											data-testid={`notification-open-${notification.relatedEntityId ?? notification.id}`}
										>
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
											<Button
												type="submit"
												size="sm"
												variant="outline"
												disabled={loading}
											>
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
