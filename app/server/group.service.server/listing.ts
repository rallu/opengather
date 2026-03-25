import { getDb } from "../db.server.ts";
import {
	getGroupMembership,
	parseGroupVisibilityMode,
	resolveGroupRole,
} from "../group-membership.service.server.ts";
import {
	canJoinGroup,
	canViewGroup,
	type ViewerRole,
} from "../permissions.server.ts";
import { getSetupStatus } from "../setup.service.server.ts";
import {
	type AuthUser,
	canDiscoverGroup,
	deriveJoinState,
	type GroupSummary,
	getMembershipStatus,
	isGroupSummary,
} from "./shared.ts";

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

	return {
		status: "ok",
		groups: summaries.filter(isGroupSummary),
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

export async function getFeedGroupIds(params: {
	authUser: AuthUser;
}): Promise<string[]> {
	if (!params.authUser) {
		return [];
	}

	const setup = await getSetupStatus();
	if (!setup.isSetup || !setup.instance) {
		return [];
	}

	const memberships = await getDb().groupMembership.findMany({
		where: {
			principalId: params.authUser.id,
			principalType: "user",
			approvalStatus: "approved",
			group: {
				instanceId: setup.instance.id,
			},
		},
		select: {
			groupId: true,
		},
	});

	return memberships.map((membership) => membership.groupId);
}
