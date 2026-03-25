import { Form, Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Container } from "~/components/ui/container";
import type { GroupDetailOkData } from "./loader.server";

export function GroupManagementPanels(params: {
	data: GroupDetailOkData;
	loading: boolean;
}) {
	return (
		<>
			{!params.data.canPost &&
			(params.data.joinState === "join" || params.data.joinState === "request") ? (
				<Container className="space-y-4 p-4">
					<p className="text-sm text-muted-foreground">
						Join this group to post and participate in member-only discussions.
					</p>
					<Form method="post">
						<input type="hidden" name="_action" value="request-access" />
						<Button
							type="submit"
							disabled={params.loading}
							data-testid="group-join-visible"
						>
							{params.data.joinState === "join" ? "Join group" : "Request access"}
						</Button>
					</Form>
				</Container>
			) : null}

			{params.data.canManage ? (
				<Container className="space-y-4 p-4">
					<p className="text-sm text-muted-foreground">
						Choose who can see this group and who needs explicit access.
					</p>
					<Form method="post" className="flex flex-wrap gap-3">
						<input type="hidden" name="_action" value="update-visibility" />
						<select
							name="visibilityMode"
							defaultValue={params.data.group.visibilityMode}
							data-testid="group-settings-visibility"
							className="rounded-md border border-input bg-background px-3 py-2 text-sm"
						>
							<option value="public">Public</option>
							<option value="instance_members">Instance members</option>
							<option value="group_members">Group members</option>
							<option value="private_invite_only">Private invite only</option>
						</select>
						<Button
							type="submit"
							variant="outline"
							disabled={params.loading}
							data-testid="group-settings-save"
						>
							Save visibility
						</Button>
					</Form>
				</Container>
			) : null}

			{params.data.pendingRequests.length > 0 ? (
				<Container className="p-4">
					<div className="space-y-3" data-testid="group-pending-list">
						{params.data.pendingRequests.map((request) => (
							<div
								key={request.userId}
								className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
								data-testid={`group-pending-request-${request.userId}`}
							>
								<div className="text-sm">
									<p className="font-medium">{request.label}</p>
									<p className="text-muted-foreground">
										{request.role} • {request.approvalStatus}
									</p>
								</div>
								<Button asChild size="sm" variant="outline">
									<Link
										to={`/approvals?request=${encodeURIComponent(request.requestKey)}`}
										data-testid={`group-pending-open-${request.userId}`}
									>
										Review in approvals
									</Link>
								</Button>
							</div>
						))}
					</div>
				</Container>
			) : null}

			{params.data.canManage ? (
				<Container className="p-4">
					<div className="space-y-3" data-testid="group-member-list">
						{params.data.members.map((member) => (
							<div
								key={member.userId}
								className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
								data-testid={`group-member-${member.userId}`}
							>
								<div className="text-sm">
									<p className="font-medium">{member.label}</p>
									<p className="text-muted-foreground">{member.role}</p>
								</div>
								{member.role === "owner" ? (
									<p className="text-xs uppercase tracking-wide text-muted-foreground">
										Owner
									</p>
								) : (
									<div className="flex flex-wrap items-center gap-2">
										<Form method="post" className="flex gap-2">
											<input
												type="hidden"
												name="_action"
												value="update-member-role"
											/>
											<input
												type="hidden"
												name="targetUserId"
												value={member.userId}
											/>
											<select
												name="role"
												defaultValue={member.role}
												data-testid={`group-member-role-${member.userId}`}
												className="rounded-md border border-input bg-background px-3 py-2 text-sm"
											>
												<option value="member">Member</option>
												<option value="moderator">Moderator</option>
												<option value="admin">Admin</option>
											</select>
											<Button
												type="submit"
												size="sm"
												disabled={params.loading}
												data-testid={`group-member-role-submit-${member.userId}`}
											>
												Update role
											</Button>
										</Form>
										<Form method="post">
											<input type="hidden" name="_action" value="remove-member" />
											<input
												type="hidden"
												name="targetUserId"
												value={member.userId}
											/>
											<Button
												type="submit"
												size="sm"
												variant="outline"
												disabled={params.loading}
												data-testid={`group-member-remove-${member.userId}`}
											>
												Remove
											</Button>
										</Form>
									</div>
								)}
							</div>
						))}
					</div>
				</Container>
			) : null}
		</>
	);
}
