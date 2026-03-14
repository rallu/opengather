import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import { loadVisibleProfile } from "~/server/profile.service.server";
import { getAuthUserFromRequest } from "~/server/session.server";
import { getSetupStatus } from "~/server/setup.service.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
	try {
		const authUser = await getAuthUserFromRequest({ request });
		const setup = await getSetupStatus();
		if (!setup.isSetup || !setup.instance) {
			return { status: "not_setup" as const, authUser };
		}

		const result = await loadVisibleProfile({
			profileUserId: params.userId ?? "",
			viewer: authUser,
			instanceId: setup.instance.id,
		});
		return {
			...result,
			authUser,
		};
	} catch {
		return { status: "error" as const, authUser: null };
	}
}

export default function ProfileDetailPage() {
	const data = useLoaderData<typeof loader>();

	if (data.status === "not_setup") {
		return (
			<AppShell authUser={data.authUser} title="Profile">
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
					Failed to load profile.
				</div>
			</AppShell>
		);
	}

	if (data.status === "not_found") {
		return (
			<AppShell authUser={data.authUser} title="Profile">
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Profile not found.
				</div>
			</AppShell>
		);
	}

	if (data.status === "requires_authentication") {
		return (
			<AppShell authUser={null} title="Profile">
				<div
					className="rounded-lg border border-border p-5"
					data-testid="profile-requires-auth-state"
				>
					<p className="text-sm text-muted-foreground">
						Sign in to view this profile.
					</p>
					<div className="mt-4 flex gap-3">
						<Button asChild>
							<Link to="/login">Sign In</Link>
						</Button>
						<Button variant="outline" asChild>
							<Link to="/register">Register</Link>
						</Button>
					</div>
				</div>
			</AppShell>
		);
	}

	if (data.status === "forbidden") {
		return (
			<AppShell authUser={data.authUser} title="Profile">
				<div
					className="rounded-lg border border-border p-5 text-sm text-muted-foreground"
					data-testid="profile-forbidden-state"
				>
					This profile is not visible to your account.
				</div>
			</AppShell>
		);
	}

	return (
		<AppShell authUser={data.authUser} title={data.name}>
			<div className="rounded-md border border-border p-4 text-sm">
				<p className="font-medium">{data.name}</p>
				<p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
					Profile visibility: {data.profileVisibility}
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-3">
				<div className="rounded-md border border-border p-4">
					<p className="text-xs uppercase tracking-wide text-muted-foreground">
						Posts
					</p>
					<p className="mt-2 text-2xl font-semibold">{data.stats.totalPosts}</p>
				</div>
				<div className="rounded-md border border-border p-4">
					<p className="text-xs uppercase tracking-wide text-muted-foreground">
						Top Level
					</p>
					<p className="mt-2 text-2xl font-semibold">
						{data.stats.topLevelPosts}
					</p>
				</div>
				<div className="rounded-md border border-border p-4">
					<p className="text-xs uppercase tracking-wide text-muted-foreground">
						Replies
					</p>
					<p className="mt-2 text-2xl font-semibold">{data.stats.replies}</p>
				</div>
			</div>

			<section className="space-y-3" data-testid="profile-activity-list">
				{data.activities.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No visible activity yet.
					</p>
				) : (
					data.activities.map((activity) => (
						<div
							key={activity.id}
							className="rounded-md border border-border p-3"
						>
							<div className="flex items-center justify-between gap-3">
								<p className="text-sm font-medium">{activity.label}</p>
								<p className="text-xs text-muted-foreground">
									{new Date(activity.createdAt).toLocaleString()}
								</p>
							</div>
							<p className="mt-2 text-sm">
								{activity.body?.trim() || "No text preview available"}
							</p>
							{activity.targetUrl ? (
								<div className="mt-2">
									<Button variant="link" className="h-auto p-0 text-xs" asChild>
										<Link to={activity.targetUrl}>Open activity</Link>
									</Button>
								</div>
							) : null}
						</div>
					))
				)}
			</section>
		</AppShell>
	);
}
