import {
	type InstanceVisibilityMode,
	instanceMemberRoles,
	type PermissionResult,
	type ViewerRole,
} from "./shared.ts";

export function canManageInstance(params: {
	viewerRole: ViewerRole;
}): PermissionResult<"admin_required"> {
	return params.viewerRole === "admin"
		? { allowed: true, reason: "allowed" }
		: { allowed: false, reason: "admin_required" };
}

export function canAccessAuditLogs(params: {
	viewerRole: ViewerRole;
}): PermissionResult<"admin_required"> {
	return canManageInstance(params);
}

export function canViewInstanceFeed(params: {
	visibilityMode: InstanceVisibilityMode;
	viewerRole: ViewerRole;
	isAuthenticated: boolean;
}): PermissionResult<
	"requires_authentication" | "membership_required" | "pending_membership"
> {
	if (params.visibilityMode === "public") {
		return { allowed: true, reason: "allowed" };
	}

	if (!params.isAuthenticated) {
		return { allowed: false, reason: "requires_authentication" };
	}

	if (instanceMemberRoles.has(params.viewerRole)) {
		return { allowed: true, reason: "allowed" };
	}

	return params.visibilityMode === "approval"
		? { allowed: false, reason: "pending_membership" }
		: { allowed: false, reason: "membership_required" };
}

export function canPostToInstanceFeed(params: {
	viewerRole: ViewerRole;
}): PermissionResult<"membership_required"> {
	return instanceMemberRoles.has(params.viewerRole)
		? { allowed: true, reason: "allowed" }
		: { allowed: false, reason: "membership_required" };
}

export function canReplyToPost(params: {
	viewerRole: ViewerRole;
}): PermissionResult<"membership_required"> {
	return canPostToInstanceFeed(params);
}
