import { randomUUID } from "node:crypto";

import { getConfig } from "./config.service.server.ts";
import { getDb } from "./db.server.ts";
import { SINGLETON_INSTANCE_ID, getSetupInstanceId } from "./setup.service.server.ts";

export async function ensureHostedOwnerAdminClaim(params: {
	localUserId: string;
	hubUserId: string;
	deps?: {
		getConfiguredOwnerHubUserId?: () => Promise<string>;
		getInstanceId?: () => Promise<string | null>;
		db?: Pick<
			ReturnType<typeof getDb>,
			"instanceMembership"
		>;
	};
}): Promise<boolean> {
	const configuredOwnerHubUserId = await (
		params.deps?.getConfiguredOwnerHubUserId ??
		(() => getConfig("hosted_owner_hub_user_id"))
	)();
	if (!configuredOwnerHubUserId || configuredOwnerHubUserId !== params.hubUserId) {
		return false;
	}

	const instanceId =
		(await (params.deps?.getInstanceId ?? getSetupInstanceId)()) ??
		SINGLETON_INSTANCE_ID;
	const db = params.deps?.db ?? getDb();
	const existingMembership = await db.instanceMembership.findFirst({
		where: {
			instanceId,
			principalId: params.localUserId,
			principalType: "user",
		},
	});

	if (
		existingMembership?.role === "admin" &&
		existingMembership.approvalStatus === "approved"
	) {
		return false;
	}

	const now = new Date();
	await db.instanceMembership.upsert({
		where: {
			instanceId_principalId_principalType: {
				instanceId,
				principalId: params.localUserId,
				principalType: "user",
			},
		},
		create: {
			id: randomUUID(),
			instanceId,
			principalId: params.localUserId,
			principalType: "user",
			role: "admin",
			approvalStatus: "approved",
			createdAt: now,
			updatedAt: now,
		},
		update: {
			role: "admin",
			approvalStatus: "approved",
			updatedAt: now,
		},
	});

	return true;
}
