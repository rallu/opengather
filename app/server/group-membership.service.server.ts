import { randomUUID } from "node:crypto";
import { getDb } from "./db.server.ts";
import type { GroupRole, GroupVisibilityMode } from "./permissions.server.ts";
import { resolveGroupRoleFromMembership } from "./permissions.server.ts";

const groupVisibilityModes = new Set<GroupVisibilityMode>([
	"public",
	"instance_members",
	"group_members",
	"private_invite_only",
]);

type GroupMembershipRecord = {
	role: string;
	approvalStatus: string;
} | null;

type GroupMembershipDb = {
	communityGroup: {
		findUnique(args: {
			where: { id: string };
			select: { visibilityMode: true };
		}): Promise<{ visibilityMode: string } | null>;
	};
	groupMembership: {
		findFirst(args: {
			where: {
				groupId: string;
				principalId: string;
				principalType: "user";
			};
			select: {
				id?: true;
				role?: true;
				approvalStatus?: true;
			};
		}): Promise<{
			id?: string;
			role?: string;
			approvalStatus?: string;
		} | null>;
		create(args: {
			data: {
				id: string;
				groupId: string;
				principalId: string;
				principalType: "user";
				role: string;
				approvalStatus: string;
				createdAt: Date;
				updatedAt: Date;
			};
		}): Promise<unknown>;
	};
};

export function parseGroupVisibilityMode(raw: unknown): GroupVisibilityMode {
	if (
		typeof raw === "string" &&
		groupVisibilityModes.has(raw as GroupVisibilityMode)
	) {
		return raw as GroupVisibilityMode;
	}
	return "public";
}

export function resolveGroupRole(membership: GroupMembershipRecord): GroupRole {
	return resolveGroupRoleFromMembership(membership);
}

export async function getGroupVisibility(params: {
	groupId: string;
	db?: GroupMembershipDb;
}): Promise<GroupVisibilityMode> {
	const db = params.db ?? getDb();
	const group = await db.communityGroup.findUnique({
		where: { id: params.groupId },
		select: { visibilityMode: true },
	});

	return parseGroupVisibilityMode(group?.visibilityMode);
}

export async function getGroupMembership(params: {
	groupId: string;
	userId: string;
	db?: GroupMembershipDb;
}): Promise<GroupMembershipRecord> {
	const db = params.db ?? getDb();
	const membership = await db.groupMembership.findFirst({
		where: {
			groupId: params.groupId,
			principalId: params.userId,
			principalType: "user",
		},
		select: {
			role: true,
			approvalStatus: true,
		},
	});

	if (!membership?.role || !membership.approvalStatus) {
		return null;
	}

	return {
		role: membership.role,
		approvalStatus: membership.approvalStatus,
	};
}

export async function ensureGroupMembership(params: {
	groupId: string;
	userId: string;
	approvalMode: "automatic" | "manual";
	role?: "member" | "moderator" | "admin" | "owner";
	db?: GroupMembershipDb;
}): Promise<{
	created: boolean;
	membership: {
		role: string;
		approvalStatus: string;
	};
}> {
	const db = params.db ?? getDb();
	const existing = await db.groupMembership.findFirst({
		where: {
			groupId: params.groupId,
			principalId: params.userId,
			principalType: "user",
		},
		select: {
			id: true,
			role: true,
			approvalStatus: true,
		},
	});

	if (existing?.role && existing.approvalStatus) {
		return {
			created: false,
			membership: {
				role: existing.role,
				approvalStatus: existing.approvalStatus,
			},
		};
	}

	const membership = {
		role: params.role ?? "member",
		approvalStatus:
			params.approvalMode === "automatic" ? "approved" : "pending",
	};
	const now = new Date();

	await db.groupMembership.create({
		data: {
			id: randomUUID(),
			groupId: params.groupId,
			principalId: params.userId,
			principalType: "user",
			role: membership.role,
			approvalStatus: membership.approvalStatus,
			createdAt: now,
			updatedAt: now,
		},
	});

	return {
		created: true,
		membership,
	};
}
