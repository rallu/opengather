import { Form, Link } from "react-router";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import type {
	ServerSettingsActionData,
	ServerSettingsLoaderData,
} from "./route.server";

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

export function ServerSettingsPage(params: {
	actionData: ServerSettingsActionData;
	data: ServerSettingsLoaderData;
}) {
	const actionSection =
		params.actionData && "section" in params.actionData
			? params.actionData.section
			: undefined;

	if (!params.data.authUser) {
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

	if (params.data.viewerRole !== "admin") {
		return (
			<AppShell
				authUser={params.data.authUser}
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
			authUser={params.data.authUser}
			title="Server Settings"
			showServerSettings
		>
			<section className="space-y-3 rounded-md border border-border p-4">
				{params.data.setup.isSetup && params.data.setup.instance ? (
					<div className="space-y-2 text-sm">
						<p>
							<span className="text-muted-foreground">Name:</span>{" "}
							{params.data.setup.instance.name}
						</p>
						<p>
							<span className="text-muted-foreground">Visibility:</span>{" "}
							{params.data.setup.instance.visibilityMode}
						</p>
						<p>
							<span className="text-muted-foreground">Approval:</span>{" "}
							{params.data.setup.instance.approvalMode}
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
						enabled={params.data.authProviders.hub}
						description="Connect this server to OpenGather Hub"
					/>
					<AuthProviderTile
						label="Email + Password"
						enabled={params.data.authProviders.emailPassword}
						description="Local account access"
					/>
					<AuthProviderTile
						label="Google"
						enabled={params.data.authProviders.google}
						description="Optional social login"
					/>
				</div>
			</section>

			<section className="rounded-md border border-border p-4">
				<h2 className="mb-3 text-base font-semibold">Hub Connection</h2>
				{params.actionData &&
				"error" in params.actionData &&
				actionSection === "hub" ? (
					<div className="mb-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{params.actionData.error}
					</div>
				) : null}
				{params.actionData &&
				"ok" in params.actionData &&
				actionSection === "hub" ? (
					<div className="mb-3 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700">
						Saved.
					</div>
				) : null}
				<Form method="post" className="space-y-4">
					<input type="hidden" name="_action" value="save-hub" />
					<label className="block space-y-2 text-sm">
						<span className="font-medium">Hub URL</span>
						<input
							name="hubBaseUrl"
							type="url"
							defaultValue={params.data.hubConfig?.hubBaseUrl ?? ""}
							placeholder="https://opengather.net"
							className="w-full rounded-md border border-input bg-background px-3 py-2"
						/>
					</label>
					<label className="flex items-center gap-2 text-sm font-medium">
						<input
							name="hubEnabled"
							type="checkbox"
							defaultChecked={Boolean(params.data.hubConfig?.hubEnabled)}
						/>
						Enable Hub connection
					</label>
					<p className="text-sm text-muted-foreground">
						Enabling auto-registers this server with the configured hub and stores
						the returned OAuth credentials.
					</p>
					{params.data.hubConfig?.hubEnabled ? (
						<div className="rounded-md border border-border p-3 text-sm">
							<p>
								<span className="text-muted-foreground">Hub URL:</span>{" "}
								{params.data.hubConfig.hubBaseUrl || "-"}
							</p>
							<p>
								<span className="text-muted-foreground">Client ID:</span>{" "}
								{params.data.hubConfig.hubClientId || "-"}
							</p>
							<p>
								<span className="text-muted-foreground">Discovery URL:</span>{" "}
								{params.data.hubConfig.hubOidcDiscoveryUrl || "-"}
							</p>
							<p>
								<span className="text-muted-foreground">Instance URL:</span>{" "}
								{params.data.hubConfig.hubInstanceBaseUrl || "-"}
							</p>
						</div>
					) : null}
					<Button type="submit">Save Hub settings</Button>
				</Form>
			</section>

			<section className="rounded-md border border-border p-4">
				<h2 className="mb-3 text-base font-semibold">Media Storage</h2>
				<p className="mb-3 text-sm text-muted-foreground">
					Assets are always served through this app. The storage driver controls
					where processed files are kept.
				</p>
				{params.actionData &&
				"error" in params.actionData &&
				actionSection === "media" ? (
					<div className="mb-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{params.actionData.error}
					</div>
				) : null}
				{params.actionData &&
				"ok" in params.actionData &&
				actionSection === "media" ? (
					<div className="mb-3 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700">
						Saved.
					</div>
				) : null}
				<Form method="post" className="space-y-4">
					<input type="hidden" name="_action" value="save-media" />
					<label className="block space-y-2 text-sm">
						<span className="font-medium">Storage driver</span>
						<select
							name="mediaStorageDriver"
							defaultValue={
								params.data.hubConfig?.mediaStorageDriver ?? "local"
							}
							className="w-full rounded-md border border-input bg-background px-3 py-2"
						>
							<option value="local">Local filesystem</option>
						</select>
					</label>
					<label className="block space-y-2 text-sm">
						<span className="font-medium">Local media root</span>
						<input
							name="mediaLocalRoot"
							type="text"
							defaultValue={
								params.data.hubConfig?.mediaLocalRoot ?? "./storage/media"
							}
							className="w-full rounded-md border border-input bg-background px-3 py-2"
						/>
					</label>
					<p className="text-sm text-muted-foreground">
						Video processing runs through the separate `npm run worker:media`
						process.
					</p>
					<Button type="submit">Save media settings</Button>
				</Form>
			</section>

			<section className="rounded-md border border-border p-4">
				<h2 className="mb-3 text-base font-semibold">Rendering Locale</h2>
				<p className="mb-3 text-sm text-muted-foreground">
					Server rendering and client hydration both use these values when
					formatting dates. Set them explicitly so timestamps do not reformat
					after hydration.
				</p>
				{params.actionData &&
				"error" in params.actionData &&
				actionSection === "rendering" ? (
					<div className="mb-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{params.actionData.error}
					</div>
				) : null}
				{params.actionData &&
				"ok" in params.actionData &&
				actionSection === "rendering" ? (
					<div className="mb-3 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700">
						Saved.
					</div>
				) : null}
				<Form method="post" className="space-y-4">
					<input type="hidden" name="_action" value="save-rendering" />
					<label className="block space-y-2 text-sm">
						<span className="font-medium">Locale</span>
						<input
							name="renderLocale"
							type="text"
							defaultValue={params.data.hubConfig?.renderLocale ?? "en-US"}
							placeholder="en-US"
							className="w-full rounded-md border border-input bg-background px-3 py-2"
						/>
					</label>
					<label className="block space-y-2 text-sm">
						<span className="font-medium">Time zone</span>
						<input
							name="renderTimeZone"
							type="text"
							defaultValue={params.data.hubConfig?.renderTimeZone ?? "UTC"}
							placeholder="UTC"
							className="w-full rounded-md border border-input bg-background px-3 py-2"
						/>
					</label>
					<p className="text-sm text-muted-foreground">
						Use a BCP 47 locale like `en-US` and an IANA time zone like `UTC` or
						`Europe/Helsinki`.
					</p>
					<Button type="submit">Save rendering settings</Button>
				</Form>
			</section>

			<section className="rounded-md border border-border p-4">
				<h2 className="mb-3 text-base font-semibold">Audit Logs</h2>
				<p className="mb-3 text-sm text-muted-foreground">
					Review security-sensitive admin actions and request context.
				</p>
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" asChild>
						<Link to="/audit-logs">Open Audit Logs</Link>
					</Button>
					<Button variant="outline" asChild>
						<Link to="/debug/error-monitoring" prefetch="intent">
							Send Test Error Event
						</Link>
					</Button>
				</div>
			</section>
		</AppShell>
	);
}
