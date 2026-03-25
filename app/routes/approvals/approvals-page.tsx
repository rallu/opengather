import type { PendingApprovalRow } from "~/server/approval.service.server";
import { Form, Link } from "react-router";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import { Container } from "~/components/ui/container";
import type { ActionData, ApprovalsLoaderData } from "./route.server";

function ApprovalSection(params: {
	title: string;
	description: string;
	rows: PendingApprovalRow[];
	scope: "instance" | "group";
	focusedRequestKey: string;
	loading: boolean;
}) {
	return (
		<Container className="space-y-4 p-5">
			<div className="space-y-1">
				<h2 className="text-base font-semibold">{params.title}</h2>
				<p className="text-sm text-muted-foreground">{params.description}</p>
			</div>
			{params.rows.length === 0 ? (
				<p className="text-sm text-muted-foreground">No pending requests.</p>
			) : (
				<div className="space-y-3">
					{params.rows.map((row) => {
						const isFocused = params.focusedRequestKey === row.requestKey;
						return (
							<div
								key={row.requestKey}
								id={`approval-${row.requestKey}`}
								className={`space-y-3 rounded-lg border p-4 ${
									isFocused ? "border-primary bg-primary/5" : "border-border"
								}`}
								data-testid={`approvals-row-${row.requestKey}`}
							>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="space-y-1">
										<p className="font-medium">{row.requesterLabel}</p>
										<p className="text-sm text-muted-foreground">
											{params.scope === "instance"
												? "Server membership request"
												: `Access request for ${row.groupName ?? "group"}`}
										</p>
										<p className="text-xs text-muted-foreground">
											Requested {new Date(row.createdAt).toLocaleString()}
										</p>
									</div>
									<div className="flex flex-wrap gap-2">
										<Form method="post">
											<input type="hidden" name="_action" value="approve" />
											<input type="hidden" name="scope" value={params.scope} />
											<input
												type="hidden"
												name="targetUserId"
												value={row.requesterUserId}
											/>
											{row.groupId ? (
												<input type="hidden" name="groupId" value={row.groupId} />
											) : null}
											<Button
												type="submit"
												size="sm"
												disabled={params.loading}
												data-testid={`approvals-approve-${row.requestKey}`}
											>
												Approve
											</Button>
										</Form>
										<Form method="post">
											<input type="hidden" name="_action" value="reject" />
											<input type="hidden" name="scope" value={params.scope} />
											<input
												type="hidden"
												name="targetUserId"
												value={row.requesterUserId}
											/>
											{row.groupId ? (
												<input type="hidden" name="groupId" value={row.groupId} />
											) : null}
											<Button
												type="submit"
												size="sm"
												variant="outline"
												disabled={params.loading}
												data-testid={`approvals-reject-${row.requestKey}`}
											>
												Reject
											</Button>
										</Form>
									</div>
								</div>
								{row.groupId ? (
									<div>
										<Button asChild variant="ghost" size="sm">
											<Link to={`/groups/${row.groupId}`}>Open group</Link>
										</Button>
									</div>
								) : null}
							</div>
						);
					})}
				</div>
			)}
		</Container>
	);
}

export function ApprovalsPage(params: {
	actionData: ActionData;
	data: ApprovalsLoaderData;
	loading: boolean;
}) {
	if (params.data.status === "unauthenticated") {
		return (
			<AppShell authUser={null} title="Approvals">
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

	if (params.data.status === "not_setup") {
		return (
			<AppShell authUser={params.data.authUser} title="Approvals">
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Setup is not completed.
				</div>
			</AppShell>
		);
	}

	if (params.data.status === "forbidden") {
		return (
			<AppShell authUser={params.data.authUser} title="Approvals">
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Approval access required.
				</div>
			</AppShell>
		);
	}

	const totalCount =
		params.data.instanceRequests.length + params.data.groupRequests.length;

	return (
		<AppShell
			authUser={params.data.authUser}
			title="Approvals"
			showServerSettings={params.data.viewerRole === "admin"}
		>
			{params.actionData && "error" in params.actionData ? (
				<div
					className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
					data-testid="approvals-action-error"
				>
					{params.actionData.error}
				</div>
			) : null}

			{params.actionData && "message" in params.actionData ? (
				<div
					className="rounded-md border border-border bg-muted/40 p-3 text-sm"
					data-testid="approvals-action-message"
				>
					{params.actionData.message}
				</div>
			) : null}

			<Container className="space-y-2 p-5">
				<h1 className="text-xl font-semibold">Pending approvals</h1>
				<p className="text-sm text-muted-foreground">
					Review server membership and group access requests from one queue.
				</p>
				<p
					className="text-sm text-muted-foreground"
					data-testid="approvals-count"
				>
					{totalCount} pending request{totalCount === 1 ? "" : "s"}.
				</p>
			</Container>

			<ApprovalSection
				title="Server membership"
				description="People waiting for manual approval to access this server."
				rows={params.data.instanceRequests}
				scope="instance"
				focusedRequestKey={params.data.focusedRequestKey}
				loading={params.loading}
			/>

			<ApprovalSection
				title="Group access"
				description="Pending requests for groups you manage."
				rows={params.data.groupRequests}
				scope="group"
				focusedRequestKey={params.data.focusedRequestKey}
				loading={params.loading}
			/>
		</AppShell>
	);
}
