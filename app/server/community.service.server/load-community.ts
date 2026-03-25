import { getFeedGroupIds } from "../group.service.server.ts";
import {
	loadPostListPage,
	type PostListPage,
	type PostListSortMode,
} from "../post-list.service.server.ts";
import { getSetupStatus } from "../setup.service.server.ts";
import {
	ensureCanRead,
	ensureInstanceMembershipForUser,
	isAdmin,
} from "./access.ts";
import type { CommunityUser } from "./shared.ts";

export async function loadCommunity(params: {
	user: CommunityUser | null;
	sortMode: PostListSortMode;
	cursor?: string | null;
}): Promise<{
	status:
		| "ok"
		| "not_setup"
		| "requires_registration"
		| "pending_membership"
		| "forbidden";
	viewerRole: "guest" | "member" | "moderator" | "admin";
	page: PostListPage;
}> {
	const status = await getSetupStatus();
	if (!status.isSetup || !status.instance) {
		return {
			status: "not_setup",
			viewerRole: "guest",
			page: {
				items: [],
				hasMore: false,
				sortMode: params.sortMode,
			},
		};
	}

	await ensureInstanceMembershipForUser({
		instanceId: status.instance.id,
		approvalMode: status.instance.approvalMode,
		user: params.user,
	});

	const readAccess = await ensureCanRead({
		instanceId: status.instance.id,
		user: params.user,
	});
	if (!readAccess.allowed) {
		return {
			status:
				readAccess.reason === "requires_registration"
					? "requires_registration"
					: readAccess.reason === "pending_membership"
						? "pending_membership"
						: "forbidden",
			viewerRole: readAccess.viewerRole,
			page: {
				items: [],
				hasMore: false,
				sortMode: params.sortMode,
			},
		};
	}

	const includeHidden = await isAdmin({
		instanceId: status.instance.id,
		user: params.user,
	});
	const readableGroupIds = await getFeedGroupIds({
		authUser: params.user
			? {
					id: params.user.id,
					hubUserId: params.user.hubUserId,
				}
			: null,
	});
	const page = await loadPostListPage({
		scope: {
			kind: "community",
			instanceId: status.instance.id,
			readableGroupIds,
		},
		sortMode: params.sortMode,
		cursor: params.cursor,
		includeHidden,
	});

	return {
		status: "ok",
		viewerRole: readAccess.viewerRole,
		page,
	};
}
