import { randomUUID } from "node:crypto";
import { getDb } from "./db.server";
import {
	ensureGroupMembership,
	getGroupMembership,
	parseGroupVisibilityMode,
	resolveGroupRole,
} from "./group-membership.service.server";
import {
	canJoinGroup,
	canManageGroup,
	canPostToGroup,
	canViewGroup,
	type GroupRole,
	type GroupVisibilityMode,
	type ViewerRole,
} from "./permissions.server";
import { getSetupStatus } from "./setup.service.server";

type AuthUser = {
	id: string;
	hubUserId?: string;
	name?: string;
	email?: string;
} | null;

type GroupMembershipStatus = "none" | "pending" | "approved" | "rejected";

function isGroupSummary(group: GroupSummary | null): group is GroupSummary {
	return group !== null;
}

export type GroupSummary = {
	id: string;
	name: string;
	description?: string;
	visibilityMode: GroupVisibilityMode;
	groupRole: GroupRole;
	membershipStatus: GroupMembershipStatus;
	joinState: "hidden" | "join" | "request" | "pending";
};

export type GroupPost = {
	id: string;
	parentPostId?: string;
	bodyText?: string;
	moderationStatus: "pending" | "approved" | "rejected" | "flagged";
	isHidden: boolean;
	isDeleted: boolean;
	createdAt: string;
};

export type GroupMemberSummary = {
	userId: string;
	label: string;
	role: GroupRole;
};

function parseManagedGroupRole(
	raw: string | null | undefined,
): Exclude<GroupRole, "guest" | "owner"> | null {
	if (raw === "member" || raw === "moderator" || raw === "admin") {
		return raw;
	}
	return null;
}

function asModerationStatus(params: {
	value: string;
}): "pending" | "approved" | "rejected" | "flagged" {
	if (
		params.value === "pending" ||
		params.value === "approved" ||
		params.value === "rejected" ||
		params.value === "flagged"
	) {
		return params.value;
	}
	return "pending";
}

function toIsoString(params: { value: Date | string }): string {
	return params.value instanceof Date
		? params.value.toISOString()
		: new Date(params.value).toISOString();
}

async function getMembershipStatus(params: {
	groupId: string;
	userId?: string;
}): Promise<GroupMembershipStatus> {
	if (!params.userId) {
		return "none";
	}

	const membership = await getGroupMembership({
		groupId: params.groupId,
		userId: params.userId,
	});

	if (!membership) {
		return "none";
	}
	if (membership.approvalStatus === "approved") {
		return "approved";
	}
	if (membership.approvalStatus === "pending") {
		return "pending";
	}
	return "rejected";
}

function deriveJoinState(params: {
	visibilityMode: GroupVisibilityMode;
	membershipStatus: GroupMembershipStatus;
	canJoin: ReturnType<typeof canJoinGroup>;
}): GroupSummary["joinState"] {
	if (params.membershipStatus === "pending") {
		return "pending";
	}
	if (!params.canJoin.allowed) {
		return "hidden";
	}
	return params.visibilityMode === "group_members" ? "request" : "join";
}

function canDiscoverGroup(params: {
	visibilityMode: GroupVisibilityMode;
	membershipStatus: GroupMembershipStatus;
	canView: ReturnType<typeof canViewGroup>;
	canJoin: ReturnType<typeof canJoinGroup>;
}): boolean {
	if (params.canView.allowed) {
		return true;
	}

	if (params.membershipStatus === "pending") {
		return true;
	}

	if (params.visibilityMode === "private_invite_only") {
		return false;
	}

	return params.canJoin.allowed;
}

function mapGroupPost(params: {
	row: {
		id: string;
		parentPostId: string | null;
		bodyText: string | null;
		moderationStatus: string;
		hiddenAt: Date | string | null;
		deletedAt: Date | string | null;
		createdAt: Date | string;
	};
}): GroupPost {
	return {
		id: params.row.id,
		parentPostId: params.row.parentPostId ?? undefined,
		bodyText: params.row.bodyText ?? undefined,
		moderationStatus: asModerationStatus({
			value: params.row.moderationStatus,
		}),
		isHidden: Boolean(params.row.hiddenAt),
		isDeleted: Boolean(params.row.deletedAt),
		createdAt: toIsoString({ value: params.row.createdAt }),
	};
}

export async function listVisibleGroups(params: {
	authUser: AuthUser;
	instanceViewerRole: ViewerRole;
}): Promise<{
	status: "ok" | "not_setup";
	groups: GroupSummary[];
}> {
	const setup = await getSetupStatus();
	if (!setup.isSetup || !setup.instance) {
		return { status: "not_setup", groups: [] };
	}

	const db = getDb();
	const groups = await db.communityGroup.findMany({
		where: { instanceId: setup.instance.id },
		orderBy: { createdAt: "asc" },
		select: {
			id: true,
			name: true,
			description: true,
			visibilityMode: true,
		},
	});

	const summaries: Array<GroupSummary | null> = await Promise.all(
		groups.map(async (group) => {
			const visibilityMode = parseGroupVisibilityMode(group.visibilityMode);
			const membership = params.authUser
				? await getGroupMembership({
						groupId: group.id,
						userId: params.authUser.id,
					})
				: null;
			const membershipStatus = params.authUser
				? await getMembershipStatus({
						groupId: group.id,
						userId: params.authUser.id,
					})
				: "none";
			const groupRole = resolveGroupRole(membership);
			const canView = canViewGroup({
				isAuthenticated: Boolean(params.authUser),
				instanceViewerRole: params.instanceViewerRole,
				groupRole,
				visibilityMode,
			});
			const canJoin = canJoinGroup({
				isAuthenticated: Boolean(params.authUser),
				instanceViewerRole: params.instanceViewerRole,
				groupRole,
				visibilityMode,
			});
			if (
				!canDiscoverGroup({
					visibilityMode,
					membershipStatus,
					canView,
					canJoin,
				})
			) {
				return null;
			}

			return {
				id: group.id,
				name: group.name,
				description: group.description ?? undefined,
				visibilityMode,
				groupRole,
				membershipStatus,
				joinState: deriveJoinState({
					visibilityMode,
					membershipStatus,
					canJoin,
				}),
			} satisfies GroupSummary;
		}),
	);

	const visibleGroups = summaries.filter(isGroupSummary);
	return {
		status: "ok",
		groups: visibleGroups,
	};
}

export async function getReadableGroupIds(params: {
	authUser: AuthUser;
	instanceViewerRole: ViewerRole;
}): Promise<string[]> {
	const setup = await getSetupStatus();
	if (!setup.isSetup || !setup.instance) {
		return [];
	}

	const db = getDb();
	const groups = await db.communityGroup.findMany({
		where: { instanceId: setup.instance.id },
		select: {
			id: true,
			visibilityMode: true,
		},
	});

	const readable = await Promise.all(
		groups.map(async (group) => {
			const visibilityMode = parseGroupVisibilityMode(group.visibilityMode);
			const membership = params.authUser
				? await getGroupMembership({
						groupId: group.id,
						userId: params.authUser.id,
					})
				: null;
			const groupRole = resolveGroupRole(membership);
			const canView = canViewGroup({
				isAuthenticated: Boolean(params.authUser),
				instanceViewerRole: params.instanceViewerRole,
				groupRole,
				visibilityMode,
			});

			return canView.allowed ? group.id : null;
		}),
	);

	return readable.filter((groupId): groupId is string => groupId !== null);
}

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

	if (params.instanceViewerRole !== "admin") {
		return { ok: false, error: "Admin access required" };
	}

	const name = params.name.trim();
	if (!name) {
		return { ok: false, error: "Group name is required" };
	}

	const db = getDb();
	const now = new Date();
	const groupId = randomUUID();
	const instanceId = setup.instance.id;
	await db.$transaction(async (trx) => {
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

export async function loadGroup(params: {
	groupId: string;
	authUser: AuthUser;
	instanceViewerRole: ViewerRole;
}): Promise<
	| { status: "not_setup" | "not_found" | "requires_authentication" }
	| {
			status: "ok" | "pending_membership" | "forbidden";
			group: {
				id: string;
				name: string;
				description?: string;
				visibilityMode: GroupVisibilityMode;
			};
			groupRole: GroupRole;
			membershipStatus: GroupMembershipStatus;
			joinState: GroupSummary["joinState"];
			canPost: boolean;
			canManage: boolean;
			posts: GroupPost[];
			pendingRequests: Array<{
				userId: string;
				label: string;
				role: string;
				approvalStatus: string;
			}>;
			members: GroupMemberSummary[];
	  }
> {
	const setup = await getSetupStatus();
	if (!setup.isSetup || !setup.instance) {
		return { status: "not_setup" };
	}

	const db = getDb();
	const group = await db.communityGroup.findFirst({
		where: {
			id: params.groupId,
			instanceId: setup.instance.id,
		},
		select: {
			id: true,
			name: true,
			description: true,
			visibilityMode: true,
		},
	});

	if (!group) {
		return { status: "not_found" };
	}

	const visibilityMode = parseGroupVisibilityMode(group.visibilityMode);
	const membership = params.authUser
		? await getGroupMembership({
				groupId: group.id,
				userId: params.authUser.id,
			})
		: null;
	const membershipStatus = params.authUser
		? await getMembershipStatus({
				groupId: group.id,
				userId: params.authUser.id,
			})
		: "none";
	const groupRole = resolveGroupRole(membership);
	const canView = canViewGroup({
		isAuthenticated: Boolean(params.authUser),
		instanceViewerRole: params.instanceViewerRole,
		groupRole,
		visibilityMode,
	});
	const canJoin = canJoinGroup({
		isAuthenticated: Boolean(params.authUser),
		instanceViewerRole: params.instanceViewerRole,
		groupRole,
		visibilityMode,
	});
	const joinState = deriveJoinState({
		visibilityMode,
		membershipStatus,
		canJoin,
	});

	if (!canView.allowed) {
		if (visibilityMode === "private_invite_only") {
			return { status: "not_found" };
		}
		if (canView.reason === "requires_authentication") {
			return { status: "requires_authentication" };
		}

		return {
			status:
				membershipStatus === "pending" ? "pending_membership" : "forbidden",
			group: {
				id: group.id,
				name: group.name,
				description: group.description ?? undefined,
				visibilityMode,
			},
			groupRole,
			membershipStatus,
			joinState,
			canPost: false,
			canManage: false,
			posts: [],
			pendingRequests: [],
			members: [],
		};
	}

	const rows = await db.post.findMany({
		where: {
			instanceId: setup.instance.id,
			groupId: group.id,
		},
		orderBy: { createdAt: "asc" },
		select: {
			id: true,
			parentPostId: true,
			bodyText: true,
			moderationStatus: true,
			hiddenAt: true,
			deletedAt: true,
			createdAt: true,
		},
	});

	const includeHidden = canManageGroup({ groupRole }).allowed;
	const posts = rows.filter((row) => {
		if (includeHidden) {
			return true;
		}
		return (
			!row.deletedAt && !row.hiddenAt && row.moderationStatus !== "rejected"
		);
	});

	const pendingRequests = canManageGroup({ groupRole }).allowed
		? await db.groupMembership.findMany({
				where: {
					groupId: group.id,
					approvalStatus: "pending",
					principalType: "user",
				},
				orderBy: { createdAt: "asc" },
				select: {
					principalId: true,
					role: true,
					approvalStatus: true,
				},
			})
		: [];
	const pendingUsers =
		pendingRequests.length > 0
			? await db.user.findMany({
					where: {
						id: {
							in: pendingRequests.map((request) => request.principalId),
						},
					},
					select: {
						id: true,
						email: true,
						name: true,
					},
				})
			: [];
	const pendingUserById = new Map(
		pendingUsers.map((user) => [user.id, user.email || user.name || user.id]),
	);
	const currentMembers = canManageGroup({ groupRole }).allowed
		? await db.groupMembership.findMany({
				where: {
					groupId: group.id,
					approvalStatus: "approved",
					principalType: "user",
				},
				orderBy: { createdAt: "asc" },
				select: {
					principalId: true,
					role: true,
				},
			})
		: [];
	const currentUsers =
		currentMembers.length > 0
			? await db.user.findMany({
					where: {
						id: {
							in: currentMembers.map((member) => member.principalId),
						},
					},
					select: {
						id: true,
						email: true,
						name: true,
					},
				})
			: [];
	const currentUserById = new Map(
		currentUsers.map((user) => [user.id, user.email || user.name || user.id]),
	);

	return {
		status: "ok",
		group: {
			id: group.id,
			name: group.name,
			description: group.description ?? undefined,
			visibilityMode,
		},
		groupRole,
		membershipStatus,
		joinState,
		canPost: canPostToGroup({ groupRole }).allowed,
		canManage: canManageGroup({ groupRole }).allowed,
		posts: posts.map((row) => mapGroupPost({ row })),
		pendingRequests: pendingRequests.map((request) => ({
			userId: request.principalId,
			label: pendingUserById.get(request.principalId) ?? request.principalId,
			role: request.role,
			approvalStatus: request.approvalStatus,
		})),
		members: currentMembers.map((member) => ({
			userId: member.principalId,
			label: currentUserById.get(member.principalId) ?? member.principalId,
			role: resolveGroupRole({
				role: member.role,
				approvalStatus: "approved",
			}),
		})),
	};
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

	const db = getDb();
	const group = await db.communityGroup.findFirst({
		where: {
			id: params.groupId,
			instanceId: setup.instance.id,
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

	return {
		ok: true,
		outcome:
			result.membership.approvalStatus === "approved" ? "joined" : "requested",
	};
}

export async function updateGroupMembershipApproval(params: {
	groupId: string;
	managerUserId: string;
	targetUserId: string;
	status: "approved" | "rejected";
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

	const updated = await getDb().groupMembership.updateMany({
		where: {
			groupId: params.groupId,
			principalId: params.targetUserId,
			principalType: "user",
		},
		data: {
			approvalStatus: params.status,
			updatedAt: new Date(),
		},
	});

	if (updated.count === 0) {
		return { ok: false, error: "Membership request not found" };
	}

	return { ok: true };
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
			instanceId: setup.instance.id,
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
