import { Form, Link } from "react-router";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import { LocalizedTimestamp } from "~/components/ui/localized-timestamp";
import type {
	ServerSettingsAgentsActionData,
	ServerSettingsAgentsLoaderData,
} from "./route.server";

const INSTANCE_SCOPE_FIELDS = [
	{
		name: "scope_instance_feed_read",
		label: "Read instance feed",
		scope: "instance.feed.read",
		defaultChecked: true,
	},
	{
		name: "scope_instance_feed_post",
		label: "Post to instance feed",
		scope: "instance.feed.post",
		defaultChecked: true,
	},
	{
		name: "scope_instance_feed_reply",
		label: "Reply in instance feed",
		scope: "instance.feed.reply",
		defaultChecked: false,
	},
	{
		name: "scope_instance_notifications_create",
		label: "Create notifications",
		scope: "instance.notifications.create",
		defaultChecked: false,
	},
] as const;

function AgentScopeCheckboxes(params: { selectedScopes?: Set<string> }) {
	return (
		<>
			{INSTANCE_SCOPE_FIELDS.map((field) => (
				<label key={field.name} className="flex items-center gap-2">
					<input
						name={field.name}
						type="checkbox"
						defaultChecked={
							params.selectedScopes
								? params.selectedScopes.has(field.scope)
								: field.defaultChecked
						}
					/>
					<span>{field.label}</span>
				</label>
			))}
		</>
	);
}

function AgentScopeList(params: { scopes: string[] }) {
	if (params.scopes.length === 0) {
		return <span className="text-muted-foreground">No scopes</span>;
	}

	return (
		<div className="flex flex-wrap gap-2">
			{params.scopes.map((scope) => (
				<code
					key={scope}
					className="rounded bg-muted px-2 py-1 text-xs text-foreground"
				>
					{scope}
				</code>
			))}
		</div>
	);
}

export function ServerSettingsAgentsPage(params: {
	data: ServerSettingsAgentsLoaderData;
	actionData: ServerSettingsAgentsActionData;
}) {
	if (!params.data.authUser) {
		return (
			<AppShell authUser={null} title="Agents" showServerSettings={false}>
				<section className="space-y-3 rounded-md border border-border p-4">
					<p className="text-sm text-muted-foreground">Sign in required.</p>
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
				title="Agents"
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
			title="Agents"
			showServerSettings
		>
			<ServerSettingsAgentsContent
				data={params.data}
				actionData={params.actionData}
			/>
		</AppShell>
	);
}

export function ServerSettingsAgentsContent(params: {
	data: ServerSettingsAgentsLoaderData;
	actionData: ServerSettingsAgentsActionData;
}) {
	return (
		<>
			<section className="space-y-3 rounded-md border border-border p-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 className="text-base font-semibold">Connect An Agent</h2>
						<p className="text-sm text-muted-foreground">
							Create a bearer token for an external client and copy the base URL
							plus Authorization header exactly once.
						</p>
					</div>
					<Button variant="outline" asChild>
						<Link to="/server-settings">Back to Server Settings</Link>
					</Button>
				</div>
				{params.actionData?.ok && params.actionData.action === "create-agent" ? (
					<div className="space-y-3 rounded-md border border-emerald-600/20 bg-emerald-500/10 p-4 text-sm">
						<p className="font-medium text-emerald-700">
							Agent created. This token is shown only once.
						</p>
						<div className="space-y-2">
							<p>
								<span className="text-muted-foreground">Base URL:</span>{" "}
								<code>{params.actionData.baseUrl}</code>
							</p>
							<p>
								<span className="text-muted-foreground">Agent ID:</span>{" "}
								<code>{params.actionData.agentId}</code>
							</p>
							<p>
								<span className="text-muted-foreground">Authorization:</span>{" "}
								<code>Bearer {params.actionData.token}</code>
							</p>
						</div>
					</div>
				) : null}
				{params.actionData?.ok && params.actionData.action === "rotate-agent" ? (
					<div className="space-y-3 rounded-md border border-emerald-600/20 bg-emerald-500/10 p-4 text-sm">
						<p className="font-medium text-emerald-700">
							Token rotated. The replacement token is shown only once.
						</p>
						<div className="space-y-2">
							<p>
								<span className="text-muted-foreground">Base URL:</span>{" "}
								<code>{params.actionData.baseUrl}</code>
							</p>
							<p>
								<span className="text-muted-foreground">Agent ID:</span>{" "}
								<code>{params.actionData.agentId}</code>
							</p>
							<p>
								<span className="text-muted-foreground">Authorization:</span>{" "}
								<code>Bearer {params.actionData.token}</code>
							</p>
						</div>
					</div>
				) : null}
				{params.actionData &&
				!params.actionData.ok &&
				(params.actionData.action === "create-agent" ||
					params.actionData.action === "disable-agent" ||
					params.actionData.action === "rotate-agent" ||
					params.actionData.action === "update-grants") ? (
					<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{params.actionData.error}
					</div>
				) : null}
				{params.actionData?.ok && params.actionData.action === "disable-agent" ? (
					<div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700">
						Agent disabled.
					</div>
				) : null}
				{params.actionData?.ok && params.actionData.action === "update-grants" ? (
					<div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700">
						Agent grants updated.
					</div>
				) : null}
				<Form method="post" className="grid gap-4 md:grid-cols-2">
					<input type="hidden" name="_action" value="create-agent" />
					<label className="block space-y-2 text-sm">
						<span className="font-medium">Display name</span>
						<input
							name="displayName"
							type="text"
							required
							placeholder="Codex"
							className="w-full rounded-md border border-input bg-background px-3 py-2"
						/>
					</label>
					<label className="block space-y-2 text-sm">
						<span className="font-medium">Display label</span>
						<input
							name="displayLabel"
							type="text"
							placeholder="Codex agent"
							className="w-full rounded-md border border-input bg-background px-3 py-2"
						/>
					</label>
					<label className="block space-y-2 text-sm">
						<span className="font-medium">Instance role</span>
						<select
							name="instanceRole"
							defaultValue="member"
							className="w-full rounded-md border border-input bg-background px-3 py-2"
						>
							<option value="member">Member</option>
							<option value="moderator">Moderator</option>
							<option value="admin">Admin</option>
						</select>
					</label>
					<div className="space-y-2 text-sm">
						<p className="font-medium">Instance scopes</p>
						<AgentScopeCheckboxes />
					</div>
					<div className="md:col-span-2">
						<p className="mb-3 text-sm text-muted-foreground">
							This UI currently manages instance-scoped grants. Group grants
							still need a later pass.
						</p>
						<Button type="submit">Create agent token</Button>
					</div>
				</Form>
			</section>

			<section className="rounded-md border border-border p-4">
				<h2 className="mb-3 text-base font-semibold">Existing Agents</h2>
				{params.data.agents.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No agents created yet.
					</p>
				) : (
					<div className="space-y-3">
						{params.data.agents.map((agent) => (
							<div key={agent.id} className="rounded-md border border-border p-3">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="space-y-1">
										<p className="font-medium">
											{agent.displayLabel || agent.displayName}
										</p>
										<p className="text-xs text-muted-foreground">
											<code>{agent.id}</code>
										</p>
										<p className="text-sm text-muted-foreground">
											Role: {agent.role} | Enabled:{" "}
											{agent.isEnabled ? "yes" : "no"}
										</p>
									</div>
									<div className="text-right text-sm text-muted-foreground">
										<p>
											Last used:{" "}
											{agent.lastUsedAt ? (
												<LocalizedTimestamp value={agent.lastUsedAt} />
											) : (
												"never"
											)}
										</p>
										<p>
											Created: <LocalizedTimestamp value={agent.createdAt} />
										</p>
									</div>
								</div>
								<div className="mt-3 space-y-2">
									<p className="text-sm font-medium">Granted scopes</p>
									<AgentScopeList
										scopes={agent.grants.map((grant) => grant.scope)}
									/>
									<div className="pt-1">
										<div className="flex flex-wrap gap-2">
											<Form
												method="post"
												className="space-y-3 rounded-md border border-border p-3"
											>
												<input
													type="hidden"
													name="_action"
													value="update-grants"
												/>
												<input type="hidden" name="agentId" value={agent.id} />
												<div className="space-y-2 text-sm">
													<p className="font-medium">Edit instance scopes</p>
													<AgentScopeCheckboxes
														selectedScopes={new Set(
															agent.grants.map((grant) => grant.scope),
														)}
													/>
												</div>
												<Button type="submit" variant="outline">
													Save grants
												</Button>
											</Form>
											<Form method="post">
												<input
													type="hidden"
													name="_action"
													value="rotate-agent"
												/>
												<input type="hidden" name="agentId" value={agent.id} />
												<Button
													type="submit"
													variant="outline"
													disabled={!agent.isEnabled}
												>
													Rotate token
												</Button>
											</Form>
											<Form method="post">
												<input
													type="hidden"
													name="_action"
													value="disable-agent"
												/>
												<input type="hidden" name="agentId" value={agent.id} />
												<Button
													type="submit"
													variant="outline"
													disabled={!agent.isEnabled}
												>
													{agent.isEnabled ? "Disable agent" : "Disabled"}
												</Button>
											</Form>
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</section>
		</>
	);
}
