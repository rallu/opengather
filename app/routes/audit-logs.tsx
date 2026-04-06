import { Link, useLoaderData } from "react-router";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import { LocalizedTimestamp } from "~/components/ui/localized-timestamp";
import type { loader } from "./audit-logs.server";
export { loader } from "./audit-logs.server";

export default function AuditLogsPage() {
	const data = useLoaderData<typeof loader>();

	if (data.status === "unauthenticated") {
		return (
			<AppShell authUser={null} title="Audit Logs">
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

	if (data.status === "forbidden") {
		return (
			<AppShell
				authUser={data.authUser}
				title="Audit Logs"
				showServerSettings={false}
			>
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Admin access required.
				</div>
			</AppShell>
		);
	}

	if (data.status === "error") {
		return (
			<AppShell authUser={null} title="Audit Logs">
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Failed to load audit logs.
				</div>
			</AppShell>
		);
	}

	const hasFilters =
		Boolean(data.filters.actorType) ||
		Boolean(data.filters.actorId) ||
		Boolean(data.filters.resourceType) ||
		Boolean(data.filters.resourceId) ||
		Boolean(data.filters.action);

	return (
		<AppShell authUser={data.authUser} title="Audit Logs" showServerSettings>
			<section className="rounded-md border border-border p-4">
				<div className="mb-3 flex items-center justify-between gap-3">
					<div className="space-y-1">
						<p className="text-sm text-muted-foreground">
							Showing latest {data.logs.length} entries.
						</p>
						{hasFilters ? (
							<p className="text-xs text-muted-foreground">
								Filtered
								{data.filters.actorType ? ` actorType=${data.filters.actorType}` : ""}
								{data.filters.actorId ? ` actorId=${data.filters.actorId}` : ""}
								{data.filters.resourceType
									? ` resourceType=${data.filters.resourceType}`
									: ""}
								{data.filters.resourceId
									? ` resourceId=${data.filters.resourceId}`
									: ""}
								{data.filters.action ? ` action=${data.filters.action}` : ""}
							</p>
						) : null}
					</div>
					<div className="flex gap-2">
						{hasFilters ? (
							<Button variant="outline" asChild>
								<Link to="/audit-logs">Clear filters</Link>
							</Button>
						) : null}
						<Button variant="outline" asChild>
							<Link to="/server-settings">Back to Server Settings</Link>
						</Button>
					</div>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full min-w-[900px] border-collapse text-sm">
						<thead>
							<tr className="border-b border-border text-left text-muted-foreground">
								<th className="px-2 py-2 font-medium">Time</th>
								<th className="px-2 py-2 font-medium">Action</th>
								<th className="px-2 py-2 font-medium">Actor</th>
								<th className="px-2 py-2 font-medium">Resource</th>
								<th className="px-2 py-2 font-medium">Payload</th>
							</tr>
						</thead>
						<tbody>
							{data.logs.length === 0 ? (
								<tr>
									<td colSpan={5} className="px-2 py-4 text-muted-foreground">
										No audit entries yet.
									</td>
								</tr>
							) : (
								data.logs.map((row) => (
									<tr
										key={row.id}
										className="border-b border-border/60 align-top"
									>
										<td className="px-2 py-2 whitespace-nowrap">
											<LocalizedTimestamp value={row.createdAt} />
										</td>
										<td className="px-2 py-2">
											<code>{row.action}</code>
										</td>
										<td className="px-2 py-2">
											<code>{row.actorLabel}</code>
										</td>
										<td className="px-2 py-2">
											<code>{row.resourceLabel}</code>
										</td>
										<td className="px-2 py-2 text-xs text-muted-foreground">
											{row.payloadText || "-"}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</section>
		</AppShell>
	);
}
