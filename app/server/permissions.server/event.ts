import {
	type AuthAwareParams,
	type EventParticipantStatus,
	type EventVisibilityMode,
	type GroupRole,
	groupManagerRoles,
	groupMemberRoles,
	type GroupVisibilityMode,
	instanceMemberRoles,
	type PermissionResult,
	type ViewerRole,
} from "./shared.ts";

export function resolveEventVisibilityMode(params: {
	visibilityMode: EventVisibilityMode;
	groupVisibilityMode?: GroupVisibilityMode | null;
}): Exclude<EventVisibilityMode, "inherit"> {
	if (params.visibilityMode !== "inherit") {
		return params.visibilityMode;
	}

	if (params.groupVisibilityMode === "instance_members") {
		return "instance_members";
	}
	if (params.groupVisibilityMode === "group_members") {
		return "group_members";
	}
	if (params.groupVisibilityMode === "private_invite_only") {
		return "private_invite_only";
	}
	return "public";
}

export function canViewEvent(
	params: AuthAwareParams & {
		instanceViewerRole: ViewerRole;
		groupRole: GroupRole;
		partcipationStatus?: EventParticipantStatus;
		visibilityMode: Exclude<EventVisibilityMode, "inherit">;
	},
): PermissionResult<
	| "requires_authentication"
	| "instance_membership_required"
	| "group_membership_required"
	| "participant_required"
	| "invite_required"
> {
	const participationStatus = params.partcipationStatus ?? "none";

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
		params.visibilityMode === "participants" &&
		(participationStatus === "approved" ||
			groupManagerRoles.has(params.groupRole))
	) {
		return { allowed: true, reason: "allowed" };
	}

	if (
		params.visibilityMode === "private_invite_only" &&
		(participationStatus === "approved" ||
			participationStatus === "invited" ||
			groupManagerRoles.has(params.groupRole))
	) {
		return { allowed: true, reason: "allowed" };
	}

	if (params.visibilityMode === "instance_members") {
		return { allowed: false, reason: "instance_membership_required" };
	}
	if (params.visibilityMode === "group_members") {
		return { allowed: false, reason: "group_membership_required" };
	}
	if (params.visibilityMode === "participants") {
		return { allowed: false, reason: "participant_required" };
	}
	return { allowed: false, reason: "invite_required" };
}

export function canParticipateInEvent(
	params: AuthAwareParams & {
		instanceViewerRole: ViewerRole;
		groupRole: GroupRole;
		partcipationStatus?: EventParticipantStatus;
		visibilityMode: Exclude<EventVisibilityMode, "inherit">;
	},
): PermissionResult<
	| "requires_authentication"
	| "already_has_access"
	| "instance_membership_required"
	| "group_membership_required"
	| "invite_required"
> {
	const participationStatus = params.partcipationStatus ?? "none";

	if (!params.isAuthenticated) {
		return { allowed: false, reason: "requires_authentication" };
	}

	if (participationStatus === "approved" || participationStatus === "pending") {
		return { allowed: false, reason: "already_has_access" };
	}

	if (
		params.visibilityMode === "instance_members" &&
		!instanceMemberRoles.has(params.instanceViewerRole)
	) {
		return { allowed: false, reason: "instance_membership_required" };
	}

	if (
		params.visibilityMode === "group_members" &&
		!groupMemberRoles.has(params.groupRole)
	) {
		return { allowed: false, reason: "group_membership_required" };
	}

	if (params.visibilityMode === "participants") {
		return { allowed: true, reason: "allowed" };
	}

	if (params.visibilityMode === "private_invite_only") {
		return participationStatus === "invited"
			? { allowed: true, reason: "allowed" }
			: { allowed: false, reason: "invite_required" };
	}

	return { allowed: true, reason: "allowed" };
}
