import { randomUUID } from "node:crypto";
import { notifyPendingGroupMembershipApprovers } from "../approval.service.server.ts";
import { getDb } from "../db.server.ts";
import {
	ensureGroupMembership,
	getGroupMembership,
	parseGroupVisibilityMode,
	resolveGroupRole,
} from "../group-membership.service.server.ts";
import {
	canJoinGroup,
	type GroupVisibilityMode,
	type ViewerRole,
} from "../permissions.server.ts";
import { getSetupStatus } from "../setup.service.server.ts";
import { getMembershipStatus, type AuthUser } from "./shared.ts";

export async function createGroup(params: {
	authUser: NonNullable<AuthUser>;
	instanceViewerRole: ViewerRole;
	name: string;
	description?: string;
	visibilityMode: GroupVisibilityMode;
}): Promise<{ ok: true; groupId: string } | { ok: false; error: string }> {
	const setup = await getSetupStatus();
	if (!setup.isSetup || !setup.instance) {
		return { ok: false, error: "Setup not completed" };
	}
	const instanceId = setup.instance.id;

	if (params.instanceViewerRole !== "admin") {
		return { ok: false, error: "Admin access required" };
	}

	const name = params.name.trim();
	if (!name) {
		return { ok: false, error: "Group name is required" };
	}

	const now = new Date();
	const groupId = randomUUID();
	await getDb().$transaction(async (trx) => {
		await trx.communityGroup.create({
			data: {
				id: groupId,
				instanceId,
				name,
				description: params.description?.trim() || null,
				visibilityMode: params.visibilityMode,
				createdAt: now,
				updatedAt: now,
			},
		});
		await trx.groupMembership.create({
			data: {
				id: randomUUID(),
				groupId,
				principalId: params.authUser.id,
				principalType: "user",
				role: "owner",
				approvalStatus: "approved",
				createdAt: now,
				updatedAt: now,
			},
		});
	});

	return { ok: true, groupId };
}

export async function requestGroupAccess(params: {
	groupId: string;
	authUser: NonNullable<AuthUser>;
	instanceViewerRole: ViewerRole;
}): Promise<
	| { ok: true; outcome: "joined" | "requested" | "pending" }
	| { ok: false; error: string }
> {
	const setup = await getSetupStatus();
	if (!setup.isSetup || !setup.instance) {
		return { ok: false, error: "Setup not completed" };
	}
	const instanceId = setup.instance.id;

	const group = await getDb().communityGroup.findFirst({
		where: {
			id: params.groupId,
			instanceId,
		},
		select: {
			id: true,
			visibilityMode: true,
		},
	});

	if (!group) {
		return { ok: false, error: "Group not found" };
	}

	const visibilityMode = parseGroupVisibilityMode(group.visibilityMode);
	const membership = await getGroupMembership({
		groupId: group.id,
		userId: params.authUser.id,
	});
	const membershipStatus = await getMembershipStatus({
		groupId: group.id,
		userId: params.authUser.id,
	});
	const groupRole = resolveGroupRole(membership);

	if (membershipStatus === "pending") {
		return { ok: true, outcome: "pending" };
	}

	const joinDecision = canJoinGroup({
		isAuthenticated: true,
		instanceViewerRole: params.instanceViewerRole,
		groupRole,
		visibilityMode,
	});

	if (!joinDecision.allowed) {
		return { ok: false, error: joinDecision.reason };
	}

	const approvalMode =
		visibilityMode === "group_members" ? "manual" : "automatic";
	const result = await ensureGroupMembership({
		groupId: group.id,
		userId: params.authUser.id,
		approvalMode,
	});
	if (result.created && result.membership.approvalStatus === "pending") {
		await notifyPendingGroupMembershipApprovers({
			groupId: group.id,
			requesterUserId: params.authUser.id,
		});
	}

	return {
		ok: true,
		outcome:
			result.membership.approvalStatus === "approved" ? "joined" : "requested",
	};
}
