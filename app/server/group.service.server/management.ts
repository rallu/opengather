import { resolveGroupMembershipApproval } from "../approval.service.server.ts";
import { getDb } from "../db.server.ts";
import {
	getGroupMembership,
	parseGroupVisibilityMode,
	resolveGroupRole,
} from "../group-membership.service.server.ts";
import {
	canManageGroup,
	type GroupRole,
	type GroupVisibilityMode,
} from "../permissions.server.ts";
import { getSetupStatus } from "../setup.service.server.ts";
import { parseManagedGroupRole } from "./shared.ts";

export async function updateGroupMembershipApproval(params: {
	groupId: string;
	managerUserId: string;
	targetUserId: string;
	status: "approved" | "rejected";
}): Promise<{ ok: true } | { ok: false; error: string }> {
	return resolveGroupMembershipApproval(params);
}

export async function updateGroupVisibility(params: {
	groupId: string;
	managerUserId: string;
	visibilityMode: GroupVisibilityMode;
}): Promise<
	| { ok: true; previousVisibilityMode: GroupVisibilityMode }
	| { ok: false; error: string }
> {
	const setup = await getSetupStatus();
	if (!setup.isSetup || !setup.instance) {
		return { ok: false, error: "Setup not completed" };
	}
	const instanceId = setup.instance.id;

	const managerMembership = await getGroupMembership({
		groupId: params.groupId,
		userId: params.managerUserId,
	});
	const managerRole = resolveGroupRole(managerMembership);
	if (!canManageGroup({ groupRole: managerRole }).allowed) {
		return { ok: false, error: "Group manager access required" };
	}

	const existing = await getDb().communityGroup.findFirst({
		where: {
			id: params.groupId,
			instanceId,
		},
		select: { visibilityMode: true },
	});
	if (!existing) {
		return { ok: false, error: "Group not found" };
	}

	const previousVisibilityMode = parseGroupVisibilityMode(
		existing.visibilityMode,
	);
	await getDb().communityGroup.update({
		where: { id: params.groupId },
		data: {
			visibilityMode: params.visibilityMode,
			updatedAt: new Date(),
		},
	});

	return { ok: true, previousVisibilityMode };
}

export async function updateGroupMemberRole(params: {
	groupId: string;
	managerUserId: string;
	targetUserId: string;
	role: string;
}): Promise<
	| {
			ok: true;
			role: Exclude<GroupRole, "guest" | "owner">;
	  }
	| { ok: false; error: string }
> {
	const setup = await getSetupStatus();
	if (!setup.isSetup || !setup.instance) {
		return { ok: false, error: "Setup not completed" };
	}

	const nextRole = parseManagedGroupRole(params.role);
	if (!nextRole) {
		return { ok: false, error: "Unsupported group role" };
	}

	const managerMembership = await getGroupMembership({
		groupId: params.groupId,
		userId: params.managerUserId,
	});
	const managerRole = resolveGroupRole(managerMembership);
	if (!canManageGroup({ groupRole: managerRole }).allowed) {
		return { ok: false, error: "Group manager access required" };
	}

	const targetMembership = await getDb().groupMembership.findFirst({
		where: {
			groupId: params.groupId,
			principalId: params.targetUserId,
			principalType: "user",
			approvalStatus: "approved",
		},
		select: {
			role: true,
			approvalStatus: true,
		},
	});
	if (!targetMembership) {
		return { ok: false, error: "Member not found" };
	}
	if (resolveGroupRole(targetMembership) === "owner") {
		return { ok: false, error: "Owner role cannot be reassigned" };
	}

	await getDb().groupMembership.updateMany({
		where: {
			groupId: params.groupId,
			principalId: params.targetUserId,
			principalType: "user",
			approvalStatus: "approved",
		},
		data: {
			role: nextRole,
			updatedAt: new Date(),
		},
	});

	return { ok: true, role: nextRole };
}

export async function removeGroupMember(params: {
	groupId: string;
	managerUserId: string;
	targetUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const setup = await getSetupStatus();
	if (!setup.isSetup || !setup.instance) {
		return { ok: false, error: "Setup not completed" };
	}

	const managerMembership = await getGroupMembership({
		groupId: params.groupId,
		userId: params.managerUserId,
	});
	const managerRole = resolveGroupRole(managerMembership);
	if (!canManageGroup({ groupRole: managerRole }).allowed) {
		return { ok: false, error: "Group manager access required" };
	}

	const targetMembership = await getDb().groupMembership.findFirst({
		where: {
			groupId: params.groupId,
			principalId: params.targetUserId,
			principalType: "user",
		},
		select: {
			role: true,
			approvalStatus: true,
		},
	});
	if (!targetMembership) {
		return { ok: false, error: "Member not found" };
	}
	if (resolveGroupRole(targetMembership) === "owner") {
		return { ok: false, error: "Owner cannot be removed" };
	}

	const removed = await getDb().groupMembership.deleteMany({
		where: {
			groupId: params.groupId,
			principalId: params.targetUserId,
			principalType: "user",
		},
	});
	if (removed.count === 0) {
		return { ok: false, error: "Member not found" };
	}

	return { ok: true };
}
