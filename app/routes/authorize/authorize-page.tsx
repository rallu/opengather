import { Form, Link, useActionData, useLoaderData } from "react-router";
import type {
	AuthorizeActionData,
	AuthorizeLoaderData,
} from "./route.server";

const INSTANCE_SCOPE_OPTIONS = [
	{
		id: "scope_instance_feed_read",
		label: "Read the instance feed",
		scope: "instance.feed.read",
	},
	{
		id: "scope_instance_feed_post",
		label: "Post in the instance feed",
		scope: "instance.feed.post",
	},
	{
		id: "scope_instance_feed_reply",
		label: "Reply in the instance feed",
		scope: "instance.feed.reply",
	},
	{
		id: "scope_instance_notifications_create",
		label: "Create notifications",
		scope: "instance.notifications.create",
	},
] as const;

export function AuthorizeContent(params: {
	data: AuthorizeLoaderData;
	actionData?: AuthorizeActionData;
}) {
	const requestedScopes = new Set(params.data.oauth.scope);

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
			<div className="space-y-2">
				<p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">
					MCP Authorization
				</p>
				<h1 className="text-3xl font-semibold">Connect Codex to OpenGather</h1>
				<p className="text-muted-foreground">
					Approve one local agent for this MCP client. After approval, Codex
					will use refresh-backed sessions instead of a pasted bearer token.
				</p>
			</div>

			<section className="rounded-xl border border-border bg-card p-5 shadow-sm">
				<h2 className="text-lg font-medium">Authorization request</h2>
				<dl className="mt-4 grid gap-3 text-sm">
					<div>
						<dt className="font-medium text-foreground">Client ID</dt>
						<dd className="text-muted-foreground">
							{params.data.oauth.clientId || "Public client"}
						</dd>
					</div>
					<div>
						<dt className="font-medium text-foreground">Redirect URI</dt>
						<dd className="break-all text-muted-foreground">
							{params.data.oauth.redirectUri}
						</dd>
					</div>
					<div>
						<dt className="font-medium text-foreground">Requested scopes</dt>
						<dd className="text-muted-foreground">
							{params.data.oauth.scope.length > 0
								? params.data.oauth.scope.join(", ")
								: "No explicit scopes requested. The chosen agent's existing grants will apply."}
						</dd>
					</div>
				</dl>
			</section>

			<Form method="post" className="space-y-6 rounded-xl border border-border bg-card p-5 shadow-sm">
				{params.actionData && !params.actionData.ok ? (
					<div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{params.actionData.error}
					</div>
				) : null}

				<section className="space-y-3">
					<h2 className="text-lg font-medium">Choose an existing agent</h2>
					<div className="space-y-3">
						{params.data.agents.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No enabled agents exist yet. Create one below.
							</p>
						) : (
							params.data.agents.map((agent) => (
								<label
									key={agent.id}
									className="flex cursor-pointer flex-col gap-1 rounded-lg border border-border p-3"
								>
									<span className="flex items-center gap-2">
										<input type="radio" name="agentId" value={agent.id} />
										<span className="font-medium">
											{agent.displayLabel || agent.displayName}
										</span>
									</span>
									<span className="text-sm text-muted-foreground">
										Scopes:{" "}
										{agent.grants.length > 0
											? agent.grants.map((grant) => grant.scope).join(", ")
											: "none"}
									</span>
								</label>
							))
						)}
					</div>
				</section>

				<section className="space-y-4 border-t border-border pt-5">
					<h2 className="text-lg font-medium">Or create a fresh MCP agent</h2>
					<label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3">
						<input type="radio" name="agentId" value="__new__" />
						<span>Create a new agent for this MCP client</span>
					</label>
					<div className="grid gap-4 md:grid-cols-2">
						<label className="flex flex-col gap-2 text-sm">
							<span className="font-medium">Display name</span>
							<input
								type="text"
								name="displayName"
								defaultValue="Codex"
								className="rounded-md border border-input bg-background px-3 py-2"
							/>
						</label>
						<label className="flex flex-col gap-2 text-sm">
							<span className="font-medium">Display label</span>
							<input
								type="text"
								name="displayLabel"
								defaultValue="Codex MCP agent"
								className="rounded-md border border-input bg-background px-3 py-2"
							/>
						</label>
					</div>
					<div className="space-y-2">
						<p className="text-sm font-medium">Instance scopes for the new agent</p>
						<div className="grid gap-2">
							{INSTANCE_SCOPE_OPTIONS.map((option) => (
								<label key={option.id} className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										name={option.id}
										defaultChecked={requestedScopes.has(option.scope)}
									/>
									<span>{option.label}</span>
								</label>
							))}
						</div>
					</div>
				</section>

				<div className="flex flex-wrap items-center gap-3">
					<button
						type="submit"
						name="decision"
						value="approve"
						className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
					>
						Approve once
					</button>
					<button
						type="submit"
						name="decision"
						value="deny"
						className="rounded-md border border-border px-4 py-2"
					>
						Deny
					</button>
					<Link to="/server-settings/agents" className="text-sm text-muted-foreground underline underline-offset-4">
						Manage agents
					</Link>
				</div>
			</Form>
		</div>
	);
}

export function AuthorizePage() {
	const data = useLoaderData() as AuthorizeLoaderData;
	const actionData = useActionData() as AuthorizeActionData;
	return <AuthorizeContent data={data} actionData={actionData} />;
}
