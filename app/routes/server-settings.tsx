import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import { getServerConfig, setConfig } from "~/server/config.service.server";
import { getDb } from "~/server/db.server";
import {
	getHubIdentityForLocalUser,
	linkHubInstanceForUser,
} from "~/server/hub.service.server";
import { getAuthUserFromRequest } from "~/server/session.server";
import { getSetupStatus } from "~/server/setup.service.server";

async function resolveViewerRole(params: {
	request: Request;
}): Promise<{
	authUser: Awaited<ReturnType<typeof getAuthUserFromRequest>>;
	setup: Awaited<ReturnType<typeof getSetupStatus>>;
	viewerRole: "guest" | "member" | "moderator" | "admin";
}> {
	const authUser = await getAuthUserFromRequest({ request: params.request });
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

	return { authUser, setup, viewerRole };
}

export async function action({ request }: ActionFunctionArgs) {
	try {
		const { authUser, viewerRole } = await resolveViewerRole({ request });
		if (!authUser) {
			return { error: "Sign in required." };
		}
		if (viewerRole !== "admin") {
			return { error: "Admin access required." };
		}

		const formData = await request.formData();
		const hubEnabled = String(formData.get("hubEnabled") ?? "") === "on";
		const hubBaseUrl = String(formData.get("hubBaseUrl") ?? "").trim();
		const hubOidcDiscoveryUrl = String(
			formData.get("hubOidcDiscoveryUrl") ?? "",
		).trim();
		const hubClientId = String(formData.get("hubClientId") ?? "").trim();
		const hubClientSecret = String(formData.get("hubClientSecret") ?? "").trim();
		const hubRedirectUri = String(formData.get("hubRedirectUri") ?? "").trim();
		const hubInstanceName = String(formData.get("hubInstanceName") ?? "").trim();
		const hubInstanceBaseUrl = String(
			formData.get("hubInstanceBaseUrl") ?? "",
		).trim();
		const hubInstancePushSecret = String(
			formData.get("hubInstancePushSecret") ?? "",
		).trim();

		await Promise.all([
			setConfig("hub_enabled", hubEnabled),
			setConfig("hub_base_url", hubBaseUrl || "http://localhost:9000"),
			setConfig(
				"hub_oidc_discovery_url",
				hubOidcDiscoveryUrl ||
					`${hubBaseUrl || "http://localhost:9000"}/api/auth/.well-known/openid-configuration`,
			),
			setConfig("hub_client_id", hubClientId),
			setConfig("hub_client_secret", hubClientSecret),
			setConfig(
				"hub_redirect_uri",
				hubRedirectUri || "http://localhost:5173/auth/hub/callback",
			),
			setConfig("hub_instance_name", hubInstanceName || "OpenGather Instance"),
			setConfig(
				"hub_instance_base_url",
				hubInstanceBaseUrl || "http://localhost:5173",
			),
			setConfig("hub_instance_push_secret", hubInstancePushSecret),
		]);

		if (hubEnabled) {
			const identity = await getHubIdentityForLocalUser({
				localUserId: authUser.id,
			});
			await linkHubInstanceForUser({
				hubUserId: identity?.hubUserId ?? authUser.id,
				hubAccessToken: identity?.hubAccessToken,
			});
		}

		return { ok: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown error";
		return { error: `Failed to save server settings: ${message}` };
	}
}

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		const { authUser, setup, viewerRole } = await resolveViewerRole({ request });
		const config = await getServerConfig();

		return {
			authUser,
			viewerRole,
			setup,
			authProviders: {
				emailPassword: true,
				google: Boolean(config.googleClientId && config.googleClientSecret),
				hub: Boolean(
					config.hubEnabled && config.hubClientId && config.hubClientSecret,
				),
			},
			hubConfig: config,
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
			hubConfig: null,
		};
	}
}

export default function ServerSettingsPage() {
	const data = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();

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

			<section className="rounded-md border border-border p-4">
				<h2 className="mb-3 text-base font-semibold">Hub Connection</h2>
				{actionData && "error" in actionData ? (
					<div className="mb-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{actionData.error}
					</div>
				) : null}
				{actionData && "ok" in actionData ? (
					<div className="mb-3 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700">
						Saved.
					</div>
				) : null}
				<Form method="post" className="space-y-4">
					<label className="flex items-center gap-2 text-sm font-medium">
						<input
							name="hubEnabled"
							type="checkbox"
							defaultChecked={Boolean(data.hubConfig?.hubEnabled)}
						/>
						Enable Hub connection
					</label>
					<div className="grid gap-4 sm:grid-cols-2">
						<ConfigField
							id="hub-base-url"
							name="hubBaseUrl"
							label="Hub base URL"
							defaultValue={data.hubConfig?.hubBaseUrl ?? ""}
						/>
						<ConfigField
							id="hub-oidc-discovery-url"
							name="hubOidcDiscoveryUrl"
							label="Hub OIDC discovery URL"
							defaultValue={data.hubConfig?.hubOidcDiscoveryUrl ?? ""}
						/>
						<ConfigField
							id="hub-client-id"
							name="hubClientId"
							label="Hub client ID"
							defaultValue={data.hubConfig?.hubClientId ?? ""}
						/>
						<ConfigField
							id="hub-client-secret"
							name="hubClientSecret"
							label="Hub client secret"
							defaultValue={data.hubConfig?.hubClientSecret ?? ""}
						/>
						<ConfigField
							id="hub-redirect-uri"
							name="hubRedirectUri"
							label="Hub redirect URI"
							defaultValue={data.hubConfig?.hubRedirectUri ?? ""}
						/>
						<ConfigField
							id="hub-instance-name"
							name="hubInstanceName"
							label="Instance name in Hub"
							defaultValue={data.hubConfig?.hubInstanceName ?? ""}
						/>
						<ConfigField
							id="hub-instance-base-url"
							name="hubInstanceBaseUrl"
							label="Instance base URL"
							defaultValue={data.hubConfig?.hubInstanceBaseUrl ?? ""}
						/>
						<ConfigField
							id="hub-instance-push-secret"
							name="hubInstancePushSecret"
							label="Hub push secret"
							defaultValue={data.hubConfig?.hubInstancePushSecret ?? ""}
						/>
					</div>
					<Button type="submit">Save and re-register</Button>
				</Form>
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

function ConfigField(params: {
	id: string;
	name: string;
	label: string;
	defaultValue: string;
}) {
	return (
		<div className="space-y-2">
			<label htmlFor={params.id} className="text-sm font-medium">
				{params.label}
			</label>
			<input
				id={params.id}
				name={params.name}
				defaultValue={params.defaultValue}
				className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
			/>
		</div>
	);
}
