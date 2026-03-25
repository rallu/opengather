import {
	type AuthAwareParams,
	type GroupRole,
	groupManagerRoles,
	groupMemberRoles,
	type GroupVisibilityMode,
	instanceMemberRoles,
	type PermissionResult,
	type ViewerRole,
} from "./shared.ts";

export function canViewGroup(
	params: AuthAwareParams & {
		instanceViewerRole: ViewerRole;
		groupRole: GroupRole;
		visibilityMode: GroupVisibilityMode;
	},
): PermissionResult<
	| "requires_authentication"
	| "instance_membership_required"
	| "group_membership_required"
	| "invite_required"
> {
	if (params.visibilityMode === "public") {
		return { allowed: true, reason: "allowed" };
	}

	if (!params.isAuthenticated) {
		return { allowed: false, reason: "requires_authentication" };
	}

	if (
		params.visibilityMode === "instance_members" &&
		instanceMemberRoles.has(params.instanceViewerRole)
	) {
		return { allowed: true, reason: "allowed" };
	}

	if (
		params.visibilityMode === "group_members" &&
		groupMemberRoles.has(params.groupRole)
	) {
		return { allowed: true, reason: "allowed" };
	}

	if (
		params.visibilityMode === "private_invite_only" &&
		groupMemberRoles.has(params.groupRole)
	) {
		return { allowed: true, reason: "allowed" };
	}

	if (params.visibilityMode === "instance_members") {
		return { allowed: false, reason: "instance_membership_required" };
	}

	return params.visibilityMode === "private_invite_only"
		? { allowed: false, reason: "invite_required" }
		: { allowed: false, reason: "group_membership_required" };
}

export function canJoinGroup(
	params: AuthAwareParams & {
		instanceViewerRole: ViewerRole;
		groupRole: GroupRole;
		visibilityMode: GroupVisibilityMode;
	},
): PermissionResult<
	| "requires_authentication"
	| "already_has_access"
	| "instance_membership_required"
	| "invite_required"
> {
	if (!params.isAuthenticated) {
		return { allowed: false, reason: "requires_authentication" };
	}

	if (groupMemberRoles.has(params.groupRole)) {
		return { allowed: false, reason: "already_has_access" };
	}

	if (
		params.visibilityMode !== "public" &&
		!instanceMemberRoles.has(params.instanceViewerRole)
	) {
		return { allowed: false, reason: "instance_membership_required" };
	}

	if (params.visibilityMode === "private_invite_only") {
		return { allowed: false, reason: "invite_required" };
	}

	return { allowed: true, reason: "allowed" };
}

export function canPostToGroup(params: {
	groupRole: GroupRole;
}): PermissionResult<"group_membership_required"> {
	return groupMemberRoles.has(params.groupRole)
		? { allowed: true, reason: "allowed" }
		: { allowed: false, reason: "group_membership_required" };
}

export function canManageGroup(params: {
	groupRole: GroupRole;
}): PermissionResult<"group_manager_required"> {
	return groupManagerRoles.has(params.groupRole)
		? { allowed: true, reason: "allowed" }
		: { allowed: false, reason: "group_manager_required" };
}
