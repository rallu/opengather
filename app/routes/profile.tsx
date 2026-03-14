import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import { getDb } from "~/server/db.server";
import { getInstanceViewerRole } from "~/server/permissions.server";
import { getAuthUserFromRequest } from "~/server/session.server";
import { getSetupStatus } from "~/server/setup.service.server";

type ProfileActivity = {
	id: string;
	label: string;
	body?: string;
	targetPostId?: string;
	createdAt: string;
};

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		const authUser = await getAuthUserFromRequest({ request });
		if (!authUser) {
			return { status: "unauthenticated" as const };
		}

		const setup = await getSetupStatus();
		if (!setup.isSetup || !setup.instance) {
			return { status: "not_setup" as const, authUser };
		}

		const db = getDb();
		const viewerRole = await getInstanceViewerRole({
			instanceId: setup.instance.id,
			userId: authUser.id,
		});

		const authorIds = [authUser.id, authUser.hubUserId].filter(
			(value): value is string => Boolean(value),
		);

		const postRows = await db.post.findMany({
			where: {
				instanceId: setup.instance.id,
				authorId: { in: authorIds },
			},
			orderBy: { createdAt: "desc" },
			take: 40,
			select: {
				id: true,
				bodyText: true,
				parentPostId: true,
				createdAt: true,
			},
		});

		const moderationRows = await db.moderationDecision.findMany({
			where: {
				actorType: "human",
				actorId: { in: authorIds },
			},
			orderBy: { createdAt: "desc" },
			take: 40,
			select: {
				id: true,
				status: true,
				postId: true,
				createdAt: true,
				post: {
					select: {
						bodyText: true,
					},
				},
			},
		});

		const activities: ProfileActivity[] = [
			...postRows.map((row) => ({
				id: row.id,
				label: row.parentPostId ? "Replied to a post" : "Published a post",
				body: row.bodyText ?? undefined,
				targetPostId: row.id,
				createdAt: row.createdAt.toISOString(),
			})),
			...moderationRows.map((row) => ({
				id: row.id,
				label: `Moderated a post (${row.status})`,
				body: row.post.bodyText ?? undefined,
				targetPostId: row.postId,
				createdAt: row.createdAt.toISOString(),
			})),
		].sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);

		const posts = postRows.length;
		const replies = postRows.filter((post) =>
			Boolean(post.parentPostId),
		).length;
		const moderationActions = moderationRows.length;

		return {
			status: "ok" as const,
			authUser,
			instanceName: setup.instance.name,
			viewerRole,
			stats: {
				totalPosts: posts,
				topLevelPosts: posts - replies,
				replies,
				moderationActions,
			},
			activities: activities.slice(0, 60),
		};
	} catch {
		return { status: "error" as const };
	}
}

export default function ProfilePage() {
	const data = useLoaderData<typeof loader>();

	if (data.status === "unauthenticated") {
		return (
			<AppShell authUser={null} title="Profile">
				<div className="rounded-lg border border-border p-5">
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
					Failed to load profile.
				</div>
			</AppShell>
		);
	}

	return (
		<AppShell
			authUser={data.authUser}
			showServerSettings={data.viewerRole === "admin"}
		>
			<div className="rounded-md border border-border p-4 text-sm">
				<span className="font-medium">{data.authUser.name}</span>
				<span className="text-muted-foreground">
					{" "}
					• {data.viewerRole} • {data.instanceName}
				</span>
			</div>

			<div className="grid gap-4 sm:grid-cols-4">
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
				<div className="rounded-md border border-border p-4">
					<p className="text-xs uppercase tracking-wide text-muted-foreground">
						Actions
					</p>
					<p className="mt-2 text-2xl font-semibold">
						{data.stats.moderationActions}
					</p>
				</div>
			</div>

			<section className="space-y-3">
				{data.activities.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No activity yet. Write your first post in the feed.
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
							{activity.targetPostId ? (
								<div className="mt-2">
									<Button variant="link" className="h-auto p-0 text-xs" asChild>
										<Link to={`/feed#post-${activity.targetPostId}`}>
											Open in feed
										</Link>
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
