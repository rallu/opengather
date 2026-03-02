import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import { getDb } from "~/server/db.server";
import { getAuthUserFromRequest } from "~/server/session.server";
import { getSetupStatus } from "~/server/setup.service.server";

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
		};
	} catch {
		return {
			authUser: null,
			viewerRole: "guest" as const,
			setup: { isSetup: false },
		};
	}
}

export default function SettingsPage() {
	const data = useLoaderData<typeof loader>();

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
