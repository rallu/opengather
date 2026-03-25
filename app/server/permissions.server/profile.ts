import {
	type AuthAwareParams,
	instanceMemberRoles,
	type PermissionResult,
	type ProfileVisibilityMode,
	type ViewerRole,
} from "./shared.ts";

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
