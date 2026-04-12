import assert from "node:assert/strict";
import test from "node:test";

import { ensureHostedOwnerAdminClaim } from "./hosted-owner-claim.server.ts";

test("ensureHostedOwnerAdminClaim upgrades the configured hosted owner to admin", async () => {
	let created = 0;
	let updated = 0;
	const claimed = await ensureHostedOwnerAdminClaim({
		localUserId: "local-user-1",
		hubUserId: "hub-user-1",
		deps: {
			getConfiguredOwnerHubUserId: async () => "hub-user-1",
			getInstanceId: async () => "instance-1",
			db: {
				instanceMembership: {
					findFirst: async () => null,
					upsert: async ({
						create,
						update,
					}: {
						create: { role: string; approvalStatus: string };
						update: { role: string; approvalStatus: string };
					}) => {
						if (create.role === "admin" && create.approvalStatus === "approved") {
							created += 1;
						}
						if (update.role === "admin" && update.approvalStatus === "approved") {
							updated += 1;
						}
						return {} as never;
					},
				},
			} as never,
		},
	});

	assert.equal(claimed, true);
	assert.equal(created, 1);
	assert.equal(updated, 1);
});

test("ensureHostedOwnerAdminClaim is a no-op for a non-owner hub user", async () => {
	let upserted = false;
	const claimed = await ensureHostedOwnerAdminClaim({
		localUserId: "local-user-1",
		hubUserId: "hub-user-2",
		deps: {
			getConfiguredOwnerHubUserId: async () => "hub-user-1",
			getInstanceId: async () => "instance-1",
			db: {
				instanceMembership: {
					findFirst: async () => null,
					upsert: async () => {
						upserted = true;
						return {} as never;
					},
				},
			} as never,
		},
	});

	assert.equal(claimed, false);
	assert.equal(upserted, false);
});
