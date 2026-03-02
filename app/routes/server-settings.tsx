import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import { getDb } from "~/server/db.server";
import { getServerEnv } from "~/server/env.server";
import { getAuthUserFromRequest } from "~/server/session.server";
import { getSetupStatus } from "~/server/setup.service.server";

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		const authUser = await getAuthUserFromRequest({ request });
		const setup = await getSetupStatus();
		const env = getServerEnv();

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
			authProviders: {
				emailPassword: true,
				google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
				hub: Boolean(env.HUB_CLIENT_ID && env.HUB_CLIENT_SECRET),
			},
		};
	} catch {
		return {
			authUser: null,
			viewerRole: "guest" as const,
			setup: { isSetup: false },
			authProviders: {
				emailPassword: true,
				google: false,
				hub: false,
			},
		};
	}
}

export default function ServerSettingsPage() {
	const data = useLoaderData<typeof loader>();

	if (!data.authUser) {
		return (
			<AppShell
				authUser={null}
				title="Server Settings"
				showServerSettings={false}
			>
				<section className="space-y-3 rounded-md border border-border p-4">
					<div className="flex gap-3">
						<Button asChild>
							<Link to="/login">Sign In</Link>
						</Button>
						<Button variant="outline" asChild>
							<Link to="/register">Register</Link>
						</Button>
					</div>
				</section>
			</AppShell>
		);
	}

	if (data.viewerRole !== "admin") {
		return (
			<AppShell
				authUser={data.authUser}
				title="Server Settings"
				showServerSettings={false}
			>
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Admin access required.
				</div>
			</AppShell>
		);
	}

	return (
		<AppShell
			authUser={data.authUser}
			title="Server Settings"
			showServerSettings={true}
		>
			<section className="space-y-3 rounded-md border border-border p-4">
				{data.setup.isSetup && data.setup.instance ? (
					<div className="space-y-2 text-sm">
						<p>
							<span className="text-muted-foreground">Name:</span>{" "}
							{data.setup.instance.name}
						</p>
						<p>
							<span className="text-muted-foreground">Slug:</span>{" "}
							{data.setup.instance.slug}
						</p>
						<p>
							<span className="text-muted-foreground">Visibility:</span>{" "}
							{data.setup.instance.visibilityMode}
						</p>
						<p>
							<span className="text-muted-foreground">Approval:</span>{" "}
							{data.setup.instance.approvalMode}
						</p>
						<p>
							<span className="text-muted-foreground">Model:</span> single
							server, one feed
						</p>
					</div>
				) : (
					<div className="space-y-3">
						<p className="text-sm text-muted-foreground">
							Server is not set up yet.
						</p>
						<Button asChild>
							<Link to="/setup">Run Setup</Link>
						</Button>
					</div>
				)}
			</section>

			<section className="rounded-md border border-border p-4">
				<div className="grid gap-3 sm:grid-cols-3">
					<AuthProviderTile
						label="Hub"
						enabled={data.authProviders.hub}
						description="Recommended identity provider"
					/>
					<AuthProviderTile
						label="Email + Password"
						enabled={data.authProviders.emailPassword}
						description="Local account access"
					/>
					<AuthProviderTile
						label="Google"
						enabled={data.authProviders.google}
						description="Optional social login"
					/>
				</div>
			</section>
		</AppShell>
	);
}

function AuthProviderTile(params: {
	label: string;
	description: string;
	enabled: boolean;
}) {
	return (
		<div className="rounded-md border border-border p-3">
			<p className="text-sm font-medium">{params.label}</p>
			<p className="mt-1 text-xs text-muted-foreground">{params.description}</p>
			<p className="mt-2 text-xs">
				<span
					className={
						params.enabled ? "text-emerald-600" : "text-muted-foreground"
					}
				>
					{params.enabled ? "Enabled" : "Disabled"}
				</span>
			</p>
		</div>
	);
}
