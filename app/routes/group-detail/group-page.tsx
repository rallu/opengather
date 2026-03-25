import { AppShell } from "~/components/app-shell";
import { Badge } from "~/components/ui/badge";
import { ContextBar } from "~/components/ui/context-bar";
import type { PostListItem } from "~/server/post-list.service.server";
import { GroupFeedSection } from "./group-feed-section";
import { GroupManagementPanels } from "./group-management-panels";
import { GroupStateNotice } from "./group-state-notice";
import type { GroupDetailLoaderData } from "./loader.server";

export function GroupDetailPage(params: {
	data: GroupDetailLoaderData;
	errorMessage?: string;
	loading: boolean;
	message?: string;
	pathname: string;
	priorityPost?: PostListItem;
}) {
	const group =
		params.data.status === "ok" ||
		params.data.status === "pending_membership" ||
		params.data.status === "forbidden"
			? params.data.group
			: null;

	return (
		<AppShell
			authUser={params.data.authUser}
			showServerSettings={params.data.viewerRole === "admin"}
		>
			{params.errorMessage ? (
				<div
					className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
					data-testid="group-action-error"
				>
					{params.errorMessage}
				</div>
			) : null}

			{params.message ? (
				<div
					className="rounded-md border border-border bg-muted/40 p-3 text-sm"
					data-testid="group-action-message"
				>
					{params.message}
				</div>
			) : null}

			{group ? (
				<ContextBar
					backTo="/groups"
					breadcrumbs={[
						{ label: "Groups", to: "/groups" },
						{ label: group.name },
					]}
					actions={
						<Badge variant="neutral" data-testid="group-visibility-mode">
							{group.visibilityMode}
						</Badge>
					}
				/>
			) : null}

			<GroupStateNotice data={params.data} loading={params.loading} />

			{params.data.status === "ok" ? (
				<>
					<GroupManagementPanels data={params.data} loading={params.loading} />
					<GroupFeedSection
						data={params.data}
						loading={params.loading}
						pathname={params.pathname}
						priorityPost={params.priorityPost}
					/>
				</>
			) : null}
		</AppShell>
	);
}
