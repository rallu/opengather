import type {
	canJoinGroup,
	canViewGroup,
	GroupRole,
	GroupVisibilityMode,
} from "../permissions.server.ts";
import { getGroupMembership } from "../group-membership.service.server.ts";

export type AuthUser = {
	id: string;
	hubUserId?: string;
	name?: string;
	email?: string;
} | null;

export type GroupMembershipStatus =
	| "none"
	| "pending"
	| "approved"
	| "rejected";

export type GroupSummary = {
	id: string;
	name: string;
	description?: string;
	visibilityMode: GroupVisibilityMode;
	groupRole: GroupRole;
	membershipStatus: GroupMembershipStatus;
	joinState: "hidden" | "join" | "request" | "pending";
};

export type GroupMemberSummary = {
	userId: string;
	label: string;
	role: GroupRole;
};

export function isGroupSummary(
	group: GroupSummary | null,
): group is GroupSummary {
	return group !== null;
}

export function parseManagedGroupRole(
	raw: string | null | undefined,
): Exclude<GroupRole, "guest" | "owner"> | null {
	if (raw === "member" || raw === "moderator" || raw === "admin") {
		return raw;
	}
	return null;
}

export async function getMembershipStatus(params: {
	groupId: string;
	userId?: string;
}): Promise<GroupMembershipStatus> {
	if (!params.userId) {
		return "none";
	}

	const membership = await getGroupMembership({
		groupId: params.groupId,
		userId: params.userId,
	});

	if (!membership) {
		return "none";
	}
	if (membership.approvalStatus === "approved") {
		return "approved";
	}
	if (membership.approvalStatus === "pending") {
		return "pending";
	}
	return "rejected";
}

export function deriveJoinState(params: {
	visibilityMode: GroupVisibilityMode;
	membershipStatus: GroupMembershipStatus;
	canJoin: ReturnType<typeof canJoinGroup>;
}): GroupSummary["joinState"] {
	if (params.membershipStatus === "pending") {
		return "pending";
	}
	if (!params.canJoin.allowed) {
		return "hidden";
	}
	return params.visibilityMode === "group_members" ? "request" : "join";
}

export function canDiscoverGroup(params: {
	visibilityMode: GroupVisibilityMode;
	membershipStatus: GroupMembershipStatus;
	canView: ReturnType<typeof canViewGroup>;
	canJoin: ReturnType<typeof canJoinGroup>;
}): boolean {
	if (params.canView.allowed) {
		return true;
	}

	if (params.membershipStatus === "pending") {
		return true;
	}

	if (params.visibilityMode === "private_invite_only") {
		return false;
	}

	return params.canJoin.allowed;
}
