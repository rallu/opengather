import { canManageGroup } from "../permissions.server.ts";

export type ApprovalStatus = "approved" | "rejected";

export type PendingApprovalRow = {
	scope: "instance" | "group";
	requestKey: string;
	requesterUserId: string;
	requesterLabel: string;
	createdAt: string;
	groupId?: string;
	groupName?: string;
};

export function formatUserLabel(params: {
	id: string;
	email: string | null;
	name: string | null;
}): string {
	return params.email || params.name || params.id;
}

export function toManagedGroupRole(
	raw: string,
): "guest" | "member" | "moderator" | "admin" | "owner" {
	if (
		raw === "member" ||
		raw === "moderator" ||
		raw === "admin" ||
		raw === "owner"
	) {
		return raw;
	}
	return "guest";
}

export function canManageManagedGroup(role: string) {
	return canManageGroup({ groupRole: toManagedGroupRole(role) }).allowed;
}

export function buildInstanceMembershipRequestKey(params: {
	instanceId: string;
	requesterUserId: string;
}): string {
	return `instance:${params.instanceId}:${params.requesterUserId}`;
}

export function buildGroupMembershipRequestKey(params: {
	groupId: string;
	requesterUserId: string;
}): string {
	return `group:${params.groupId}:${params.requesterUserId}`;
}
