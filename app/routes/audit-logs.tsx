import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import { LocalizedTimestamp } from "~/components/ui/localized-timestamp";
import { getDb } from "~/server/db.server";
import {
	canAccessAuditLogs,
	getViewerContext,
} from "~/server/permissions.server";

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		const viewer = await getViewerContext({ request });
		if (!viewer.authUser) {
			return {
				status: "unauthenticated" as const,
				authUser: null,
				viewerRole: "guest" as const,
				logs: [],
			};
		}

		if (!canAccessAuditLogs({ viewerRole: viewer.viewerRole }).allowed) {
			return {
				status: "forbidden" as const,
				authUser: viewer.authUser,
				viewerRole: viewer.viewerRole,
				logs: [],
			};
		}

		const db = getDb();
		const logRows = await db.auditLog.findMany({
			orderBy: { createdAt: "desc" },
			take: 200,
			select: {
				id: true,
				createdAt: true,
				action: true,
				actorId: true,
				actorType: true,
				resourceType: true,
				resourceId: true,
				payload: true,
			},
		});

		return {
			status: "ok" as const,
			authUser: viewer.authUser,
			viewerRole: viewer.viewerRole,
			logs: logRows.map((row) => ({
				...row,
				payloadText: row.payload ? JSON.stringify(row.payload) : "",
			})),
		};
	} catch {
		return {
			status: "error" as const,
			authUser: null,
			viewerRole: "guest" as const,
			logs: [],
		};
	}
}

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

	return (
		<AppShell authUser={data.authUser} title="Audit Logs" showServerSettings>
			<section className="rounded-md border border-border p-4">
				<div className="mb-3 flex items-center justify-between">
					<p className="text-sm text-muted-foreground">
						Showing latest {data.logs.length} entries.
					</p>
					<Button variant="outline" asChild>
						<Link to="/server-settings">Back to Server Settings</Link>
					</Button>
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
											<code>{row.actorType}</code>
											{row.actorId ? `:${row.actorId}` : ""}
										</td>
										<td className="px-2 py-2">
											{row.resourceType ? (
												<>
													<code>{row.resourceType}</code>
													{row.resourceId ? `:${row.resourceId}` : ""}
												</>
											) : (
												"-"
											)}
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
