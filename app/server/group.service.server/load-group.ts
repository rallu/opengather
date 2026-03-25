import { buildGroupMembershipRequestKey } from "../approval.service.server.ts";
import { getDb } from "../db.server.ts";
import {
	getGroupMembership,
	parseGroupVisibilityMode,
	resolveGroupRole,
} from "../group-membership.service.server.ts";
import {
	canJoinGroup,
	canManageGroup,
	canPostToGroup,
	canViewGroup,
	type GroupRole,
	type GroupVisibilityMode,
	type ViewerRole,
} from "../permissions.server.ts";
import {
	loadPostListPage,
	type PostListPage,
	type PostListSortMode,
} from "../post-list.service.server.ts";
import { getSetupStatus } from "../setup.service.server.ts";
import {
	type AuthUser,
	deriveJoinState,
	type GroupMemberSummary,
	type GroupMembershipStatus,
	type GroupSummary,
	getMembershipStatus,
} from "./shared.ts";

export async function loadGroup(params: {
	groupId: string;
	authUser: AuthUser;
	instanceViewerRole: ViewerRole;
	sortMode: PostListSortMode;
	cursor?: string | null;
}): Promise<
	| { status: "not_setup" | "not_found" | "requires_authentication" }
	| {
			status: "ok" | "pending_membership" | "forbidden";
			group: {
				id: string;
				name: string;
				description?: string;
				visibilityMode: GroupVisibilityMode;
			};
			groupRole: GroupRole;
			membershipStatus: GroupMembershipStatus;
			joinState: GroupSummary["joinState"];
			canPost: boolean;
			canManage: boolean;
			page: PostListPage;
			pendingRequests: Array<{
				userId: string;
				label: string;
				requestKey: string;
				role: string;
				approvalStatus: string;
			}>;
			members: GroupMemberSummary[];
	  }
> {
	const setup = await getSetupStatus();
	if (!setup.isSetup || !setup.instance) {
		return { status: "not_setup" };
	}

	const db = getDb();
	const group = await db.communityGroup.findFirst({
		where: {
			id: params.groupId,
			instanceId: setup.instance.id,
		},
		select: {
			id: true,
			name: true,
			description: true,
			visibilityMode: true,
		},
	});

	if (!group) {
		return { status: "not_found" };
	}

	const visibilityMode = parseGroupVisibilityMode(group.visibilityMode);
	const membership = params.authUser
		? await getGroupMembership({
				groupId: group.id,
				userId: params.authUser.id,
			})
		: null;
	const membershipStatus = params.authUser
		? await getMembershipStatus({
				groupId: group.id,
				userId: params.authUser.id,
			})
		: "none";
	const groupRole = resolveGroupRole(membership);
	const canView = canViewGroup({
		isAuthenticated: Boolean(params.authUser),
		instanceViewerRole: params.instanceViewerRole,
		groupRole,
		visibilityMode,
	});
	const canJoin = canJoinGroup({
		isAuthenticated: Boolean(params.authUser),
		instanceViewerRole: params.instanceViewerRole,
		groupRole,
		visibilityMode,
	});
	const joinState = deriveJoinState({
		visibilityMode,
		membershipStatus,
		canJoin,
	});

	if (!canView.allowed) {
		if (visibilityMode === "private_invite_only") {
			return { status: "not_found" };
		}
		if (canView.reason === "requires_authentication") {
			return { status: "requires_authentication" };
		}

		return {
			status:
				membershipStatus === "pending" ? "pending_membership" : "forbidden",
			group: {
				id: group.id,
				name: group.name,
				description: group.description ?? undefined,
				visibilityMode,
			},
			groupRole,
			membershipStatus,
			joinState,
			canPost: false,
			canManage: false,
			page: {
				items: [],
				hasMore: false,
				sortMode: params.sortMode,
			},
			pendingRequests: [],
			members: [],
		};
	}

	const canManage = canManageGroup({ groupRole }).allowed;
	const page = await loadPostListPage({
		scope: {
			kind: "group",
			instanceId: setup.instance.id,
			groupId: group.id,
		},
		sortMode: params.sortMode,
		cursor: params.cursor,
		includeHidden: canManage,
	});

	const pendingRequests = canManage
		? await db.groupMembership.findMany({
				where: {
					groupId: group.id,
					approvalStatus: "pending",
					principalType: "user",
				},
				orderBy: { createdAt: "asc" },
				select: {
					principalId: true,
					role: true,
					approvalStatus: true,
				},
			})
		: [];
	const pendingUsers =
		pendingRequests.length > 0
			? await db.user.findMany({
					where: {
						id: {
							in: pendingRequests.map((request) => request.principalId),
						},
					},
					select: {
						id: true,
						email: true,
						name: true,
					},
				})
			: [];
	const pendingUserById = new Map(
		pendingUsers.map((user) => [user.id, user.email || user.name || user.id]),
	);
	const currentMembers = canManage
		? await db.groupMembership.findMany({
				where: {
					groupId: group.id,
					approvalStatus: "approved",
					principalType: "user",
				},
				orderBy: { createdAt: "asc" },
				select: {
					principalId: true,
					role: true,
				},
			})
		: [];
	const currentUsers =
		currentMembers.length > 0
			? await db.user.findMany({
					where: {
						id: {
							in: currentMembers.map((member) => member.principalId),
						},
					},
					select: {
						id: true,
						email: true,
						name: true,
					},
				})
			: [];
	const currentUserById = new Map(
		currentUsers.map((user) => [user.id, user.email || user.name || user.id]),
	);

	return {
		status: "ok",
		group: {
			id: group.id,
			name: group.name,
			description: group.description ?? undefined,
			visibilityMode,
		},
		groupRole,
		membershipStatus,
		joinState,
		canPost: canPostToGroup({ groupRole }).allowed,
		canManage,
		page,
		pendingRequests: pendingRequests.map((request) => ({
			userId: request.principalId,
			label: pendingUserById.get(request.principalId) ?? request.principalId,
			requestKey: buildGroupMembershipRequestKey({
				groupId: group.id,
				requesterUserId: request.principalId,
			}),
			role: request.role,
			approvalStatus: request.approvalStatus,
		})),
		members: currentMembers.map((member) => ({
			userId: member.principalId,
			label: currentUserById.get(member.principalId) ?? member.principalId,
			role: resolveGroupRole({
				role: member.role,
				approvalStatus: "approved",
			}),
		})),
	};
}
