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

type AuthAwareParams = {
	isAuthenticated: boolean;
};

const instanceMemberRoles = new Set<ViewerRole>([
	"member",
	"moderator",
	"admin",
]);
const groupMemberRoles = new Set<GroupRole>([
	"member",
	"moderator",
	"admin",
	"owner",
]);
const groupManagerRoles = new Set<GroupRole>(["moderator", "admin", "owner"]);

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

export function canViewProfile(
	params: AuthAwareParams & {
		isSelf: boolean;
		instanceViewerRole: ViewerRole;
		visibilityMode: ProfileVisibilityMode;
	},
): PermissionResult<
	"requires_authentication" | "instance_membership_required" | "private_profile"
> {
	if (params.isSelf || params.visibilityMode === "public") {
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

	if (params.visibilityMode === "instance_members") {
		return { allowed: false, reason: "instance_membership_required" };
	}

	return { allowed: false, reason: "private_profile" };
}

export async function getInstanceViewerRole(params: {
	instanceId: string;
	userId: string;
}): Promise<ViewerRole> {
	const { getDb } = await import("./db.server.ts");
	const membership = await getDb().instanceMembership.findFirst({
		where: {
			instanceId: params.instanceId,
			principalId: params.userId,
			principalType: "user",
		},
		select: { role: true, approvalStatus: true },
	});

	return resolveViewerRoleFromMembership(membership);
}

export async function getViewerContext(params: { request: Request }): Promise<{
	authUser: {
		id: string;
		hubUserId?: string;
		name: string;
		email: string;
	} | null;
	setup: {
		isSetup: boolean;
		instance?: {
			id: string;
			name: string;
			description?: string;
			visibilityMode: "public" | "registered" | "approval";
			approvalMode: "automatic" | "manual";
		};
	};
	viewerRole: ViewerRole;
}> {
	const [{ getAuthUserFromRequest }, { getSetupStatus }] = await Promise.all([
		import("./session.server.ts"),
		import("./setup.service.server.ts"),
	]);

	const authUser = await getAuthUserFromRequest({ request: params.request });
	const setup = await getSetupStatus();

	if (!authUser || !setup.isSetup || !setup.instance) {
		return {
			authUser,
			setup,
			viewerRole: "guest",
		};
	}

	return {
		authUser,
		setup,
		viewerRole: await getInstanceViewerRole({
			instanceId: setup.instance.id,
			userId: authUser.id,
		}),
	};
}
