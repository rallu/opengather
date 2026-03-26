import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useNavigate } from "react-router";
import { AppShell } from "~/components/app-shell";
import { PostFeedItem } from "~/components/post/post-feed-item";
import { ProfileImage } from "~/components/profile/profile-image";
import { Button } from "~/components/ui/button";
import {
	Dropdown,
	DropdownContent,
	DropdownItem,
	DropdownLabel,
	DropdownTrigger,
} from "~/components/ui/dropdown";
import { FeedContainer } from "~/components/ui/feed-container";
import { Icon } from "~/components/ui/icon";
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
	const navigate = useNavigate();

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

	const fallback = data.name.trim().slice(0, 1).toUpperCase() || "?";

	return (
		<AppShell authUser={data.authUser} title={data.name}>
			<div
				className="rounded-md border border-border p-4 text-sm"
				data-testid="profile-detail-header"
			>
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-center gap-3">
						<ProfileImage
							src={data.image ?? undefined}
							alt={`${data.name} profile image`}
							fallback={fallback}
							size="lg"
						/>
						<p className="font-medium" data-testid="profile-detail-name">
							{data.name}
						</p>
					</div>
					{data.isSelf ? (
						<Dropdown className="shrink-0">
							<DropdownTrigger
								className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium"
								data-testid="profile-detail-actions-trigger"
							>
								Details
								<Icon name="chevronDown" size={16} />
							</DropdownTrigger>
							<DropdownContent
								align="end"
								data-testid="profile-detail-actions-menu"
							>
								<DropdownLabel>Profile actions</DropdownLabel>
								<DropdownItem
									onClick={() => navigate("/profile")}
									data-testid="profile-detail-edit-profile"
								>
									<Icon name="settings" size={16} />
									Edit profile
								</DropdownItem>
							</DropdownContent>
						</Dropdown>
					) : null}
				</div>
				{data.summary ? (
					<p className="mt-3 text-sm" data-testid="profile-detail-summary">
						{data.summary}
					</p>
				) : null}
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

			<FeedContainer className="space-y-4">
				<section className="space-y-3" data-testid="profile-activity-list">
					{data.posts.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No visible posts yet.
						</p>
					) : (
						data.posts.map((post) => (
							<PostFeedItem
								key={post.id}
								post={post}
								isAdmin={data.viewerRole === "admin"}
								showModerationActions={false}
							/>
						))
					)}
				</section>
			</FeedContainer>
		</AppShell>
	);
}
