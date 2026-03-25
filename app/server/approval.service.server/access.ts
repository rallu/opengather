import { getDb } from "../db.server.ts";
import type { ViewerRole } from "../permissions.server.ts";
import {
	buildGroupMembershipRequestKey,
	buildInstanceMembershipRequestKey,
	canManageManagedGroup,
	formatUserLabel,
	type PendingApprovalRow,
} from "./shared.ts";

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
		.filter((membership) => canManageManagedGroup(membership.role))
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
