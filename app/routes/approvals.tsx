import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	useNavigation,
} from "react-router";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import { Container } from "~/components/ui/container";
import {
	listPendingApprovals,
	type PendingApprovalRow,
	resolveGroupMembershipApproval,
	resolveInstanceMembershipApproval,
} from "~/server/approval.service.server";
import { writeAuditLogSafely } from "~/server/audit-log.service.server";
import { getViewerContext } from "~/server/permissions.server";

type ActionData =
	| { ok: true; message: string }
	| { ok: false; error: string }
	| undefined;

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
												<input
													type="hidden"
													name="groupId"
													value={row.groupId}
												/>
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
												<input
													type="hidden"
													name="groupId"
													value={row.groupId}
												/>
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

export async function loader({ request }: LoaderFunctionArgs) {
	const viewer = await getViewerContext({ request });
	if (!viewer.authUser) {
		return {
			status: "unauthenticated" as const,
			authUser: null,
			viewerRole: "guest" as const,
			focusedRequestKey: new URL(request.url).searchParams.get("request") ?? "",
			instanceRequests: [],
			groupRequests: [],
		};
	}

	if (!viewer.setup.isSetup || !viewer.setup.instance) {
		return {
			status: "not_setup" as const,
			authUser: viewer.authUser,
			viewerRole: viewer.viewerRole,
			focusedRequestKey: "",
			instanceRequests: [],
			groupRequests: [],
		};
	}

	const approvals = await listPendingApprovals({
		instanceId: viewer.setup.instance.id,
		userId: viewer.authUser.id,
		viewerRole: viewer.viewerRole,
	});

	if (!approvals.canAccessApprovals) {
		return {
			status: "forbidden" as const,
			authUser: viewer.authUser,
			viewerRole: viewer.viewerRole,
			focusedRequestKey: "",
			instanceRequests: [],
			groupRequests: [],
		};
	}

	return {
		status: "ok" as const,
		authUser: viewer.authUser,
		viewerRole: viewer.viewerRole,
		focusedRequestKey: new URL(request.url).searchParams.get("request") ?? "",
		instanceRequests: approvals.instanceRequests,
		groupRequests: approvals.groupRequests,
	};
}

export async function action({
	request,
}: ActionFunctionArgs): Promise<ActionData> {
	const viewer = await getViewerContext({ request });
	if (!viewer.authUser) {
		return { ok: false, error: "Sign in required." };
	}
	if (!viewer.setup.isSetup || !viewer.setup.instance) {
		return { ok: false, error: "Setup not completed." };
	}

	const formData = await request.formData();
	const actionType = String(formData.get("_action") ?? "");
	const scope = String(formData.get("scope") ?? "");
	const targetUserId = String(formData.get("targetUserId") ?? "");
	const status = actionType === "approve" ? "approved" : "rejected";

	if (!targetUserId || (actionType !== "approve" && actionType !== "reject")) {
		return { ok: false, error: "Unsupported approval action." };
	}

	if (scope === "instance") {
		const result = await resolveInstanceMembershipApproval({
			instanceId: viewer.setup.instance.id,
			managerUserId: viewer.authUser.id,
			targetUserId,
			status,
			viewerRole: viewer.viewerRole,
		});
		if (!result.ok) {
			return { ok: false, error: result.error };
		}

		await writeAuditLogSafely({
			action:
				status === "approved"
					? "instance.membership.approve"
					: "instance.membership.reject",
			actor: {
				type: "user",
				id: viewer.authUser.id,
			},
			resourceType: "instance_membership",
			resourceId: targetUserId,
			request,
			payload: {
				targetUserId,
				status,
			},
		});

		return {
			ok: true,
			message:
				status === "approved"
					? "Server membership approved."
					: "Server membership rejected.",
		};
	}

	if (scope === "group") {
		const groupId = String(formData.get("groupId") ?? "");
		if (!groupId) {
			return { ok: false, error: "Group id is required." };
		}

		const result = await resolveGroupMembershipApproval({
			groupId,
			managerUserId: viewer.authUser.id,
			targetUserId,
			status,
		});
		if (!result.ok) {
			return { ok: false, error: result.error };
		}

		await writeAuditLogSafely({
			action:
				status === "approved"
					? "group.membership.approve"
					: "group.membership.reject",
			actor: {
				type: "user",
				id: viewer.authUser.id,
			},
			resourceType: "group",
			resourceId: groupId,
			request,
			payload: {
				targetUserId,
				status,
			},
		});

		return {
			ok: true,
			message:
				status === "approved"
					? "Group membership approved."
					: "Group membership rejected.",
		};
	}

	return { ok: false, error: "Unsupported approval scope." };
}

export default function ApprovalsPage() {
	const data = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const loading = navigation.state === "submitting";

	if (data.status === "unauthenticated") {
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

	if (data.status === "not_setup") {
		return (
			<AppShell authUser={data.authUser} title="Approvals">
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Setup is not completed.
				</div>
			</AppShell>
		);
	}

	if (data.status === "forbidden") {
		return (
			<AppShell authUser={data.authUser} title="Approvals">
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Approval access required.
				</div>
			</AppShell>
		);
	}

	const totalCount = data.instanceRequests.length + data.groupRequests.length;

	return (
		<AppShell
			authUser={data.authUser}
			title="Approvals"
			showServerSettings={data.viewerRole === "admin"}
		>
			{actionData && "error" in actionData ? (
				<div
					className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
					data-testid="approvals-action-error"
				>
					{actionData.error}
				</div>
			) : null}

			{actionData && "message" in actionData ? (
				<div
					className="rounded-md border border-border bg-muted/40 p-3 text-sm"
					data-testid="approvals-action-message"
				>
					{actionData.message}
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
				rows={data.instanceRequests}
				scope="instance"
				focusedRequestKey={data.focusedRequestKey}
				loading={loading}
			/>

			<ApprovalSection
				title="Group access"
				description="Pending requests for groups you manage."
				rows={data.groupRequests}
				scope="group"
				focusedRequestKey={data.focusedRequestKey}
				loading={loading}
			/>
		</AppShell>
	);
}
