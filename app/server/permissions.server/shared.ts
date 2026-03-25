export type ViewerRole = "guest" | "member" | "moderator" | "admin";

export type GroupRole = "guest" | "member" | "moderator" | "admin" | "owner";

export type MembershipRecord = {
	role: string;
	approvalStatus: string;
} | null;

export type InstanceVisibilityMode = "public" | "registered" | "approval";

export type GroupVisibilityMode =
	| "public"
	| "instance_members"
	| "group_members"
	| "private_invite_only";

export type EventVisibilityMode =
	| "inherit"
	| "public"
	| "instance_members"
	| "group_members"
	| "participants"
	| "private_invite_only";

export type ProfileVisibilityMode = "public" | "instance_members" | "private";

export type EventParticipantStatus =
	| "none"
	| "pending"
	| "approved"
	| "invited";

export type PermissionResult<TReason extends string> =
	| {
			allowed: true;
			reason: "allowed";
	  }
	| {
			allowed: false;
			reason: TReason;
	  };

export type AuthAwareParams = {
	isAuthenticated: boolean;
};

export const instanceMemberRoles = new Set<ViewerRole>([
	"member",
	"moderator",
	"admin",
]);

export const groupMemberRoles = new Set<GroupRole>([
	"member",
	"moderator",
	"admin",
	"owner",
]);

export const groupManagerRoles = new Set<GroupRole>([
	"moderator",
	"admin",
	"owner",
]);

export function getAllowedProfileVisibilityModes(params: {
	instanceVisibilityMode: InstanceVisibilityMode;
}): ProfileVisibilityMode[] {
	if (params.instanceVisibilityMode === "public") {
		return ["public", "instance_members", "private"];
	}

	return ["instance_members", "private"];
}

export function resolveEffectiveProfileVisibility(params: {
	instanceVisibilityMode: InstanceVisibilityMode;
	visibilityMode: ProfileVisibilityMode;
}): ProfileVisibilityMode {
	if (
		params.instanceVisibilityMode !== "public" &&
		params.visibilityMode === "public"
	) {
		return "instance_members";
	}

	return params.visibilityMode;
}

export function resolveViewerRoleFromMembership(
	membership: MembershipRecord,
): ViewerRole {
	if (!membership || membership.approvalStatus !== "approved") {
		return "guest";
	}

	if (
		membership.role === "member" ||
		membership.role === "moderator" ||
		membership.role === "admin"
	) {
		return membership.role;
	}

	return "guest";
}

export function resolveGroupRoleFromMembership(
	membership: MembershipRecord,
): GroupRole {
	if (!membership || membership.approvalStatus !== "approved") {
		return "guest";
	}

	if (
		membership.role === "member" ||
		membership.role === "moderator" ||
		membership.role === "admin" ||
		membership.role === "owner"
	) {
		return membership.role;
	}

	return "guest";
}
