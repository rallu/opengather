import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
	Form,
	Link,
	redirect,
	useActionData,
	useLoaderData,
} from "react-router";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import { Container } from "~/components/ui/container";
import { writeAuditLogSafely } from "~/server/audit-log.service.server";
import {
	type CommunityUser,
	ensureInstanceMembershipForUser,
} from "~/server/community.service.server";
import { createGroup, listVisibleGroups } from "~/server/group.service.server";
import { parseGroupVisibilityMode } from "~/server/group-membership.service.server";
import { getInstanceViewerRole } from "~/server/permissions.server";
import { getAuthUserFromRequest } from "~/server/session.server";
import { getSetupStatus } from "~/server/setup.service.server";

function toCommunityUser(params: {
	authUser: Awaited<ReturnType<typeof getAuthUserFromRequest>>;
}): CommunityUser | null {
	if (!params.authUser) {
		return null;
	}
	return {
		id: params.authUser.id,
		hubUserId: params.authUser.hubUserId,
		role: "member",
	};
}

export async function loader({ request }: LoaderFunctionArgs) {
	const authUser = await getAuthUserFromRequest({ request });
	const user = toCommunityUser({ authUser });
	const setup = await getSetupStatus();
	if (!setup.isSetup || !setup.instance) {
		return {
			status: "not_setup" as const,
			authUser,
			viewerRole: "guest" as const,
			groups: [],
		};
	}

	if (user) {
		await ensureInstanceMembershipForUser({
			instanceId: setup.instance.id,
			approvalMode: setup.instance.approvalMode,
			user,
		});
	}

	const viewerRole = user
		? await getInstanceViewerRole({
				instanceId: setup.instance.id,
				userId: user.id,
			})
		: "guest";
	const result = await listVisibleGroups({
		authUser,
		instanceViewerRole: viewerRole,
	});

	return {
		status: result.status,
		authUser,
		viewerRole,
		groups: result.groups,
	};
}

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	const actionType = String(formData.get("_action") ?? "");

	if (actionType !== "create-group") {
		return { error: "Unsupported action" };
	}

	const authUser = await getAuthUserFromRequest({ request });
	if (!authUser) {
		return { error: "Sign in required" };
	}

	const setup = await getSetupStatus();
	if (!setup.isSetup || !setup.instance) {
		return { error: "Setup not completed" };
	}

	const user = toCommunityUser({ authUser });
	await ensureInstanceMembershipForUser({
		instanceId: setup.instance.id,
		approvalMode: setup.instance.approvalMode,
		user,
	});

	const viewerRole = await getInstanceViewerRole({
		instanceId: setup.instance.id,
		userId: authUser.id,
	});
	const result = await createGroup({
		authUser,
		instanceViewerRole: viewerRole,
		name: String(formData.get("name") ?? ""),
		description: String(formData.get("description") ?? ""),
		visibilityMode: parseGroupVisibilityMode(
			String(formData.get("visibilityMode") ?? "public"),
		),
	});
	if (!result.ok) {
		return { error: result.error };
	}

	await writeAuditLogSafely({
		action: "group.create",
		actor: {
			type: "user",
			id: authUser.id,
		},
		resourceType: "group",
		resourceId: result.groupId,
		request,
		payload: {
			visibilityMode: String(formData.get("visibilityMode") ?? "public"),
		},
	});

	return redirect(`/groups/${result.groupId}`);
}

export default function GroupsPage() {
	const data = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const groupsAside = (
		<>
			<Container className="rounded-lg border-border/50 bg-card">
				<div className="space-y-3 p-5 text-sm">
					<p className="text-muted-foreground">
						Public groups stay browseable here while management tools move to
						the side rail.
					</p>
					<div className="rounded-xl bg-muted/50 p-3">
						<p className="text-sm text-muted-foreground">Visible groups</p>
						<p className="mt-2 text-2xl font-semibold text-foreground">
							{data.groups.length}
						</p>
					</div>
				</div>
			</Container>

			{data.viewerRole === "admin" ? (
				<Container className="rounded-lg border-border/50 bg-card">
					<div className="space-y-3 p-5">
						<p className="text-sm text-muted-foreground">
							Create a new group here without pushing the directory further down
							the page.
						</p>
						<Form
							method="post"
							className="grid gap-3"
							data-testid="groups-create-form"
						>
							<input type="hidden" name="_action" value="create-group" />
							<input
								name="name"
								data-testid="groups-create-name"
								placeholder="Group name"
								className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
							/>
							<textarea
								name="description"
								data-testid="groups-create-description"
								placeholder="What is this group for?"
								rows={3}
								className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
							/>
							<select
								name="visibilityMode"
								data-testid="groups-create-visibility"
								defaultValue="public"
								className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
							>
								<option value="public">Public</option>
								<option value="instance_members">Instance members</option>
								<option value="group_members">Group members</option>
								<option value="private_invite_only">Private invite only</option>
							</select>
							<Button
								type="submit"
								className="w-full rounded-full"
								data-testid="groups-create-submit"
							>
								Create group
							</Button>
						</Form>
					</div>
				</Container>
			) : (
				<Container className="rounded-lg border-border/50 bg-card">
					<div className="space-y-2 p-5 text-sm text-muted-foreground">
						<p>`public` groups are visible to everyone.</p>
						<p>
							`instance_members` and `group_members` may require access before
							posting.
						</p>
						<p>
							`private_invite_only` spaces stay out of the general directory.
						</p>
					</div>
				</Container>
			)}
		</>
	);

	return (
		<AppShell
			authUser={data.authUser}
			showServerSettings={data.viewerRole === "admin"}
			aside={groupsAside}
		>
			{data.status === "not_setup" ? (
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Setup is not completed.
				</div>
			) : null}

			{actionData && "error" in actionData ? (
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					{actionData.error}
				</div>
			) : null}

			<section className="space-y-4" data-testid="groups-list">
				{data.groups.length === 0 ? (
					<div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
						No groups available yet.
					</div>
				) : (
					data.groups.map((group) => (
						<article
							key={group.id}
							className="rounded-lg border border-border p-4"
							data-testid={`group-card-${group.id}`}
						>
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="space-y-2">
									<h2 className="text-lg font-semibold">
										<Link
											to={`/groups/${group.id}`}
											className="hover:underline"
										>
											{group.name}
										</Link>
									</h2>
									{group.description ? (
										<p className="text-sm text-muted-foreground">
											{group.description}
										</p>
									) : null}
								</div>
								<div className="space-y-1 text-right text-xs uppercase tracking-wide text-muted-foreground">
									<p>{group.visibilityMode}</p>
									<p>{group.joinState}</p>
								</div>
							</div>
						</article>
					))
				)}
			</section>
		</AppShell>
	);
}
