import { getDb } from "../db.server.ts";
import { createNotification } from "../notification.service.server.ts";
import {
	buildGroupMembershipRequestKey,
	buildInstanceMembershipRequestKey,
	formatUserLabel,
} from "./shared.ts";

export async function notifyPendingInstanceMembershipApprovers(params: {
	instanceId: string;
	requesterUserId: string;
}): Promise<void> {
	const db = getDb();
	const [requester, approvers] = await Promise.all([
		db.user.findUnique({
			where: { id: params.requesterUserId },
			select: { id: true, email: true, name: true },
		}),
		db.instanceMembership.findMany({
			where: {
				instanceId: params.instanceId,
				principalType: "user",
				role: "admin",
				approvalStatus: "approved",
			},
			select: { principalId: true },
		}),
	]);

	if (!requester || approvers.length === 0) {
		return;
	}

	const requesterLabel = formatUserLabel(requester);
	const requestKey = buildInstanceMembershipRequestKey({
		instanceId: params.instanceId,
		requesterUserId: params.requesterUserId,
	});
	const targetUrl = `/approvals?request=${encodeURIComponent(requestKey)}`;

	await Promise.all(
		approvers
			.map((approver) => approver.principalId)
			.filter((approverUserId) => approverUserId !== params.requesterUserId)
			.map((userId) =>
				createNotification({
					userId,
					kind: "instance_membership_request",
					title: "New member approval request",
					body: `${requesterLabel} is waiting for server access approval.`,
					targetUrl,
					relatedEntityId: requestKey,
					payload: {
						instanceId: params.instanceId,
						requesterUserId: params.requesterUserId,
						requestKey,
					},
				}),
			),
	);
}

export async function notifyPendingGroupMembershipApprovers(params: {
	groupId: string;
	requesterUserId: string;
}): Promise<void> {
	const db = getDb();
	const [requester, group, approvers] = await Promise.all([
		db.user.findUnique({
			where: { id: params.requesterUserId },
			select: { id: true, email: true, name: true },
		}),
		db.communityGroup.findUnique({
			where: { id: params.groupId },
			select: { name: true },
		}),
		db.groupMembership.findMany({
			where: {
				groupId: params.groupId,
				principalType: "user",
				approvalStatus: "approved",
				role: { in: ["moderator", "admin", "owner"] },
			},
			select: { principalId: true },
		}),
	]);

	if (!requester || !group || approvers.length === 0) {
		return;
	}

	const requesterLabel = formatUserLabel(requester);
	const requestKey = buildGroupMembershipRequestKey({
		groupId: params.groupId,
		requesterUserId: params.requesterUserId,
	});
	const targetUrl = `/approvals?request=${encodeURIComponent(requestKey)}`;

	await Promise.all(
		approvers
			.map((approver) => approver.principalId)
			.filter((approverUserId) => approverUserId !== params.requesterUserId)
			.map((userId) =>
				createNotification({
					userId,
					kind: "group_membership_request",
					title: "New group access request",
					body: `${requesterLabel} is waiting for approval to join ${group.name}.`,
					targetUrl,
					relatedEntityId: requestKey,
					payload: {
						groupId: params.groupId,
						requesterUserId: params.requesterUserId,
						requestKey,
					},
				}),
			),
	);
}
