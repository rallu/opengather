import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import { AppShell } from "~/components/app-shell";
import { ProfileImage } from "~/components/profile/profile-image";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { getInstanceViewerRole } from "~/server/permissions.server";
import {
	loadOwnProfile,
	parseProfileUpdateInput,
	updateOwnProfile,
} from "~/server/profile.service.server";
import { getAuthUserFromRequest } from "~/server/session.server";
import { getSetupStatus } from "~/server/setup.service.server";

export async function action({ request }: ActionFunctionArgs) {
	const authUser = await getAuthUserFromRequest({ request });
	if (!authUser) {
		return { ok: false as const, error: "Sign in required." };
	}

	const formData = await request.formData();
	const parsed = parseProfileUpdateInput({
		name: String(formData.get("name") ?? ""),
		image: String(formData.get("image") ?? ""),
		summary: String(formData.get("summary") ?? ""),
	});
	if (!parsed.ok) {
		return { ok: false as const, error: parsed.error };
	}

	await updateOwnProfile({
		userId: authUser.id,
		...parsed.value,
	});

	return { ok: true as const };
}

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

		const viewerRole = await getInstanceViewerRole({
			instanceId: setup.instance.id,
			userId: authUser.id,
		});
		const profile = await loadOwnProfile({
			userId: authUser.id,
			hubUserId: authUser.hubUserId,
			instanceId: setup.instance.id,
			instanceName: setup.instance.name,
			viewerRole,
		});
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

	const fallback = data.name.trim().slice(0, 1).toUpperCase() || "?";

	return (
		<AppShell
			authUser={data.authUser}
			showServerSettings={data.viewerRole === "admin"}
		>
			<div className="rounded-md border border-border p-4 text-sm">
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
			</div>

			<section className="rounded-md border border-border p-4">
				{actionData?.ok ? (
					<p
						className="text-sm text-emerald-700"
						data-testid="profile-save-success"
					>
						Saved.
					</p>
				) : null}
				{actionData?.ok === false ? (
					<p
						className="text-sm text-destructive"
						data-testid="profile-save-error"
					>
						{actionData.error}
					</p>
				) : null}
				<Form method="post" className="mt-3 space-y-3">
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

			<div className="flex gap-3">
				<Button variant="outline" asChild>
					<Link to={data.publicProfilePath}>Open Profile Page</Link>
				</Button>
				<Button variant="outline" asChild>
					<Link to="/settings">Edit Privacy</Link>
				</Button>
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
