import { getDb } from "./db.server.ts";
import {
	createNotification,
	markNotificationsReadByRelatedEntityId,
} from "./notification.service.server.ts";
import { canManageGroup, type ViewerRole } from "./permissions.server.ts";

type ApprovalStatus = "approved" | "rejected";

export type PendingApprovalRow = {
	scope: "instance" | "group";
	requestKey: string;
	requesterUserId: string;
	requesterLabel: string;
	createdAt: string;
	groupId?: string;
	groupName?: string;
};

function formatUserLabel(params: {
	id: string;
	email: string | null;
	name: string | null;
}): string {
	return params.email || params.name || params.id;
}

function toManagedGroupRole(
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
			select: {
				principalId: true,
			},
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
				role: {
					in: ["moderator", "admin", "owner"],
				},
			},
			select: {
				principalId: true,
			},
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

async function getManagedGroupIds(params: {
	instanceId: string;
	userId: string;
}): Promise<string[]> {
	const memberships = await getDb().groupMembership.findMany({
		where: {
			principalId: params.userId,
			principalType: "user",
			approvalStatus: "approved",
			group: {
				instanceId: params.instanceId,
			},
		},
		select: {
			groupId: true,
			role: true,
		},
	});

	return memberships
		.filter(
			(membership) =>
				canManageGroup({
					groupRole: toManagedGroupRole(membership.role),
				}).allowed,
		)
		.map((membership) => membership.groupId);
}

export async function getApprovalAccess(params: {
	instanceId: string;
	userId: string;
	viewerRole: ViewerRole;
}): Promise<{
	canAccessApprovals: boolean;
	managedGroupIds: string[];
}> {
	const managedGroupIds = await getManagedGroupIds({
		instanceId: params.instanceId,
		userId: params.userId,
	});

	return {
		canAccessApprovals:
			params.viewerRole === "admin" || managedGroupIds.length > 0,
		managedGroupIds,
	};
}

export async function listPendingApprovals(params: {
	instanceId: string;
	userId: string;
	viewerRole: ViewerRole;
}): Promise<{
	canAccessApprovals: boolean;
	instanceRequests: PendingApprovalRow[];
	groupRequests: PendingApprovalRow[];
}> {
	const db = getDb();
	const { canAccessApprovals, managedGroupIds } =
		await getApprovalAccess(params);

	if (!canAccessApprovals) {
		return {
			canAccessApprovals: false,
			instanceRequests: [],
			groupRequests: [],
		};
	}

	const [instanceMemberships, groupMemberships] = await Promise.all([
		params.viewerRole === "admin"
			? db.instanceMembership.findMany({
					where: {
						instanceId: params.instanceId,
						principalType: "user",
						approvalStatus: "pending",
					},
					orderBy: { createdAt: "asc" },
					select: {
						principalId: true,
						createdAt: true,
					},
				})
			: Promise.resolve([]),
		managedGroupIds.length > 0
			? db.groupMembership.findMany({
					where: {
						groupId: {
							in: managedGroupIds,
						},
						principalType: "user",
						approvalStatus: "pending",
					},
					orderBy: { createdAt: "asc" },
					select: {
						groupId: true,
						principalId: true,
						createdAt: true,
						group: {
							select: {
								name: true,
							},
						},
					},
				})
			: Promise.resolve([]),
	]);

	const pendingUserIds = new Set<string>();
	for (const membership of instanceMemberships) {
		pendingUserIds.add(membership.principalId);
	}
	for (const membership of groupMemberships) {
		pendingUserIds.add(membership.principalId);
	}

	const users =
		pendingUserIds.size > 0
			? await db.user.findMany({
					where: {
						id: {
							in: Array.from(pendingUserIds),
						},
					},
					select: {
						id: true,
						email: true,
						name: true,
					},
				})
			: [];
	const userById = new Map(
		users.map((user) => [
			user.id,
			formatUserLabel({
				id: user.id,
				email: user.email,
				name: user.name,
			}),
		]),
	);

	return {
		canAccessApprovals: true,
		instanceRequests: instanceMemberships.map((membership) => ({
			scope: "instance",
			requestKey: buildInstanceMembershipRequestKey({
				instanceId: params.instanceId,
				requesterUserId: membership.principalId,
			}),
			requesterUserId: membership.principalId,
			requesterLabel:
				userById.get(membership.principalId) ?? membership.principalId,
			createdAt: membership.createdAt.toISOString(),
		})),
		groupRequests: groupMemberships.map((membership) => ({
			scope: "group",
			requestKey: buildGroupMembershipRequestKey({
				groupId: membership.groupId,
				requesterUserId: membership.principalId,
			}),
			requesterUserId: membership.principalId,
			requesterLabel:
				userById.get(membership.principalId) ?? membership.principalId,
			createdAt: membership.createdAt.toISOString(),
			groupId: membership.groupId,
			groupName: membership.group.name,
		})),
	};
}

export async function getPendingApprovalSummary(params: {
	instanceId: string;
	userId: string;
	viewerRole: ViewerRole;
}): Promise<{
	canAccessApprovals: boolean;
	pendingApprovalCount: number;
}> {
	const result = await listPendingApprovals(params);
	return {
		canAccessApprovals: result.canAccessApprovals,
		pendingApprovalCount:
			result.instanceRequests.length + result.groupRequests.length,
	};
}

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
