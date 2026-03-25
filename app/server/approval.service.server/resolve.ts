import { getDb } from "../db.server.ts";
import { markNotificationsReadByRelatedEntityId } from "../notification.service.server.ts";
import { canManageGroup, type ViewerRole } from "../permissions.server.ts";
import {
	buildGroupMembershipRequestKey,
	buildInstanceMembershipRequestKey,
	type ApprovalStatus,
	toManagedGroupRole,
} from "./shared";

export async function resolveInstanceMembershipApproval(params: {
	instanceId: string;
	managerUserId: string;
	targetUserId: string;
	status: ApprovalStatus;
	viewerRole: ViewerRole;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	void params.managerUserId;

	if (params.viewerRole !== "admin") {
		return { ok: false, error: "Admin access required" };
	}

	const updated = await getDb().instanceMembership.updateMany({
		where: {
			instanceId: params.instanceId,
			principalId: params.targetUserId,
			principalType: "user",
			approvalStatus: "pending",
		},
		data: {
			approvalStatus: params.status,
			updatedAt: new Date(),
		},
	});

	if (updated.count === 0) {
		return { ok: false, error: "Membership request not found" };
	}

	await markNotificationsReadByRelatedEntityId({
		relatedEntityId: buildInstanceMembershipRequestKey({
			instanceId: params.instanceId,
			requesterUserId: params.targetUserId,
		}),
	});

	return { ok: true };
}

export async function resolveGroupMembershipApproval(params: {
	groupId: string;
	managerUserId: string;
	targetUserId: string;
	status: ApprovalStatus;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const db = getDb();
	const managerMembership = await db.groupMembership.findFirst({
		where: {
			groupId: params.groupId,
			principalId: params.managerUserId,
			principalType: "user",
		},
		select: {
			role: true,
			approvalStatus: true,
		},
	});

	const managerRole =
		managerMembership?.approvalStatus === "approved"
			? toManagedGroupRole(managerMembership.role)
			: "guest";
	if (!canManageGroup({ groupRole: managerRole }).allowed) {
		return { ok: false, error: "Group manager access required" };
	}

	const updated = await db.groupMembership.updateMany({
		where: {
			groupId: params.groupId,
			principalId: params.targetUserId,
			principalType: "user",
			approvalStatus: "pending",
		},
		data: {
			approvalStatus: params.status,
			updatedAt: new Date(),
		},
	});

	if (updated.count === 0) {
		return { ok: false, error: "Membership request not found" };
	}

	await markNotificationsReadByRelatedEntityId({
		relatedEntityId: buildGroupMembershipRequestKey({
			groupId: params.groupId,
			requesterUserId: params.targetUserId,
		}),
	});

	return { ok: true };
}
