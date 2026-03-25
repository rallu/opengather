import { resolveViewerRoleFromMembership, type ViewerRole } from "./shared.ts";

export async function getInstanceViewerRole(params: {
	instanceId: string;
	userId: string;
}): Promise<ViewerRole> {
	const { getDb } = await import("../db.server.ts");
	const membership = await getDb().instanceMembership.findFirst({
		where: {
			instanceId: params.instanceId,
			principalId: params.userId,
			principalType: "user",
		},
		select: { role: true, approvalStatus: true },
	});

	return resolveViewerRoleFromMembership(membership);
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
	const [{ getAuthUserFromRequest }, { getSetupStatus }] = await Promise.all([
		import("../session.server.ts"),
		import("../setup.service.server.ts"),
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

	return {
		authUser,
		setup,
		viewerRole: await getInstanceViewerRole({
			instanceId: setup.instance.id,
			userId: authUser.id,
		}),
	};
}
