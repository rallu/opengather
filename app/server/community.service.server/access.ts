import { randomUUID } from "node:crypto";
import { notifyPendingInstanceMembershipApprovers } from "../approval.service.server.ts";
import { getConfig } from "../config.service.server.ts";
import { getDb } from "../db.server.ts";
import {
	getGroupMembership,
	parseGroupVisibilityMode,
	resolveGroupRole,
} from "../group-membership.service.server.ts";
import {
	canManageInstance,
	canPostToInstanceFeed,
	canViewGroup,
	canViewInstanceFeed,
	getInstanceViewerRole,
	type InstanceVisibilityMode,
	resolveViewerRoleFromMembership,
	type ViewerRole,
} from "../permissions.server.ts";
import type { CommunityUser } from "./shared.ts";

export async function ensureInstanceMembershipForUser(params: {
	instanceId: string;
	approvalMode: "automatic" | "manual";
	user: CommunityUser | null;
}): Promise<{
	created: boolean;
	membership: {
		role: string;
		approvalStatus: string;
	} | null;
}> {
	if (!params.user) {
		return {
			created: false,
			membership: null,
		};
	}

	const db = getDb();
	const existing = await db.instanceMembership.findFirst({
		where: {
			instanceId: params.instanceId,
			principalId: params.user.id,
			principalType: "user",
		},
		select: { role: true, approvalStatus: true },
	});
	if (existing) {
		return {
			created: false,
			membership: {
				role: existing.role,
				approvalStatus: existing.approvalStatus,
			},
		};
	}

	const membership = {
		role: "member",
		approvalStatus:
			params.approvalMode === "automatic" ? "approved" : "pending",
	};

	await db.instanceMembership.create({
		data: {
			id: randomUUID(),
			instanceId: params.instanceId,
			principalId: params.user.id,
			principalType: "user",
			role: membership.role,
			approvalStatus: membership.approvalStatus,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	});

	if (membership.approvalStatus === "pending") {
		await notifyPendingInstanceMembershipApprovers({
			instanceId: params.instanceId,
			requesterUserId: params.user.id,
		});
	}

	return {
		created: true,
		membership,
	};
}

export async function ensureCanRead(params: {
	instanceId: string;
	user: CommunityUser | null;
}): Promise<{
	allowed: boolean;
	viewerRole: ViewerRole;
	reason:
		| "allowed"
		| "requires_registration"
		| "membership_required"
		| "pending_membership";
	visibilityMode: InstanceVisibilityMode;
}> {
	const visibilityMode = await getConfig("server_visibility_mode");
	const membership = params.user
		? await getDb().instanceMembership.findFirst({
				where: {
					instanceId: params.instanceId,
					principalId: params.user.id,
					principalType: "user",
				},
				select: {
					role: true,
					approvalStatus: true,
				},
			})
		: null;
	const viewerRole = resolveViewerRoleFromMembership(membership);
	const result = canViewInstanceFeed({
		visibilityMode,
		viewerRole,
		isAuthenticated: Boolean(params.user),
	});

	if (!result.allowed) {
		if (result.reason === "requires_authentication") {
			return {
				allowed: false,
				viewerRole,
				reason: "requires_registration",
				visibilityMode,
			};
		}

		if (membership?.approvalStatus === "pending") {
			return {
				allowed: false,
				viewerRole,
				reason: "pending_membership",
				visibilityMode,
			};
		}
	}

	return {
		allowed: result.allowed,
		viewerRole,
		reason: result.allowed
			? "allowed"
			: result.reason === "requires_authentication"
				? "requires_registration"
				: result.reason,
		visibilityMode,
	};
}

export async function ensureCanPost(params: {
	instanceId: string;
	user: CommunityUser | null;
}): Promise<boolean> {
	if (!params.user) {
		return false;
	}
	const role = await getInstanceViewerRole({
		instanceId: params.instanceId,
		userId: params.user.id,
	});
	return canPostToInstanceFeed({ viewerRole: role }).allowed;
}

export async function isAdmin(params: {
	instanceId: string;
	user: CommunityUser | null;
}): Promise<boolean> {
	if (!params.user) {
		return false;
	}
	const role = await getInstanceViewerRole({
		instanceId: params.instanceId,
		userId: params.user.id,
	});
	return canManageInstance({ viewerRole: role }).allowed;
}

export async function canUserAccessPostAudience(params: {
	instanceId: string;
	userId: string;
	instanceVisibilityMode: InstanceVisibilityMode;
	group?: {
		id: string;
		visibilityMode: string;
	} | null;
}): Promise<boolean> {
	const instanceViewerRole = await getInstanceViewerRole({
		instanceId: params.instanceId,
		userId: params.userId,
	});

	if (!params.group?.id) {
		return canViewInstanceFeed({
			visibilityMode: params.instanceVisibilityMode,
			viewerRole: instanceViewerRole,
			isAuthenticated: true,
		}).allowed;
	}

	const groupRole = resolveGroupRole(
		await getGroupMembership({
			groupId: params.group.id,
			userId: params.userId,
		}),
	);

	return canViewGroup({
		isAuthenticated: true,
		instanceViewerRole,
		groupRole,
		visibilityMode: parseGroupVisibilityMode(params.group.visibilityMode),
	}).allowed;
}
