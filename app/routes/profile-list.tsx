import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { AppShell } from "~/components/app-shell";
import { ProfileCard } from "~/components/profile/profile-card";
import { getViewerContext } from "~/server/permissions.server";
import { listVisibleProfiles } from "~/server/profile.service.server";

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		const { authUser, setup, viewerRole } = await getViewerContext({ request });
		if (!setup.isSetup || !setup.instance) {
			return { status: "not_setup" as const, authUser };
		}

		const profiles = await listVisibleProfiles({
			instanceId: setup.instance.id,
			viewer: authUser,
			instanceViewerRole: viewerRole,
			instanceVisibilityMode: setup.instance.visibilityMode,
		});

		return {
			status: "ok" as const,
			authUser,
			profiles,
		};
	} catch {
		return { status: "error" as const, authUser: null };
	}
}

export default function ProfileListPage() {
	const data = useLoaderData<typeof loader>();

	if (data.status === "not_setup") {
		return (
			<AppShell authUser={data.authUser} title="Profiles">
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Server setup is not completed yet.
				</div>
			</AppShell>
		);
	}

	if (data.status === "error") {
		return (
			<AppShell authUser={null} title="Profiles">
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Failed to load profiles.
				</div>
			</AppShell>
		);
	}

	return (
		<AppShell authUser={data.authUser} title="Profiles">
			<section
				className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
				data-testid="profile-list-grid"
			>
				{data.profiles.length === 0 ? (
					<div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
						No visible profiles yet.
					</div>
				) : (
					data.profiles.map((profile) => (
						<Link
							key={profile.id}
							to={`/profiles/${profile.id}`}
							className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							data-testid="profile-list-card-link"
						>
							<ProfileCard
								name={profile.name}
								imageSrc={profile.image ?? `/profile-images/${profile.id}`}
								imageAlt={`${profile.name} profile image`}
								description={profile.summary ?? undefined}
								className="h-full"
							/>
						</Link>
					))
				)}
			</section>
		</AppShell>
	);
}
