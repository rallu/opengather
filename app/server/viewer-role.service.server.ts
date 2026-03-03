export type ViewerRole = "guest" | "member" | "moderator" | "admin";

export type MembershipRecord = {
	role: string;
	approvalStatus: string;
} | null;

export function resolveViewerRoleFromMembership(
	membership: MembershipRecord,
): ViewerRole {
	if (!membership || membership.approvalStatus !== "approved") {
		return "guest";
	}

	if (
		membership.role === "member" ||
		membership.role === "moderator" ||
		membership.role === "admin"
	) {
		return membership.role;
	}

	return "guest";
}

export function canAccessAuditLogs(params: {
	viewerRole: ViewerRole;
}): boolean {
	return params.viewerRole === "admin";
}

export async function getViewerContext(params: { request: Request }): Promise<{
	authUser: {
		id: string;
		hubUserId?: string;
		name: string;
		email: string;
	} | null;
	setup: {
		isSetup: boolean;
		instance?: {
			id: string;
			name: string;
			description?: string;
			visibilityMode: "public" | "registered" | "approval";
			approvalMode: "automatic" | "manual";
		};
	};
	viewerRole: ViewerRole;
}> {
	const [{ getDb }, { getAuthUserFromRequest }, { getSetupStatus }] =
		await Promise.all([
			import("./db.server.ts"),
			import("./session.server.ts"),
			import("./setup.service.server.ts"),
		]);

	const authUser = await getAuthUserFromRequest({ request: params.request });
	const setup = await getSetupStatus();

	if (!authUser || !setup.isSetup || !setup.instance) {
		return {
			authUser,
			setup,
			viewerRole: "guest",
		};
	}

	const membership = await getDb().instanceMembership.findFirst({
		where: {
			instanceId: setup.instance.id,
			principalId: authUser.id,
			principalType: "user",
		},
		select: { role: true, approvalStatus: true },
	});

	return {
		authUser,
		setup,
		viewerRole: resolveViewerRoleFromMembership(membership),
	};
}
