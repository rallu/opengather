import assert from "node:assert/strict";
import test from "node:test";
import {
	ensureGroupMembership,
	getGroupMembership,
	getGroupVisibility,
	parseGroupVisibilityMode,
	resolveGroupRole,
} from "./group-membership.service.server.ts";

function createMockDb(params?: {
	visibilityMode?: string;
	existingMembership?: {
		id?: string;
		role?: string;
		approvalStatus?: string;
	} | null;
}) {
	const createdMemberships: Array<Record<string, unknown>> = [];
	const db = {
		communityGroup: {
			async findUnique() {
				if (!params || params.visibilityMode === undefined) {
					return null;
				}
				return { visibilityMode: params.visibilityMode };
			},
		},
		groupMembership: {
			async findFirst() {
				return params?.existingMembership ?? null;
			},
			async create(args: { data: Record<string, unknown> }) {
				createdMemberships.push(args.data);
				return args.data;
			},
		},
	};

	return { db, createdMemberships };
}

test("parseGroupVisibilityMode constrains unsupported values to public", () => {
	assert.equal(parseGroupVisibilityMode("public"), "public");
	assert.equal(parseGroupVisibilityMode("group_members"), "group_members");
	assert.equal(parseGroupVisibilityMode("secret"), "public");
	assert.equal(parseGroupVisibilityMode(null), "public");
});

test("resolveGroupRole maps only approved memberships to active roles", () => {
	assert.equal(resolveGroupRole(null), "guest");
	assert.equal(
		resolveGroupRole({
			role: "member",
			approvalStatus: "pending",
		}),
		"guest",
	);
	assert.equal(
		resolveGroupRole({
			role: "owner",
			approvalStatus: "approved",
		}),
		"owner",
	);
});

test("getGroupVisibility reads and constrains group visibility", async () => {
	const explicit = createMockDb({ visibilityMode: "private_invite_only" });
	assert.equal(
		await getGroupVisibility({ groupId: "group-1", db: explicit.db }),
		"private_invite_only",
	);

	const fallback = createMockDb({ visibilityMode: "unknown" });
	assert.equal(
		await getGroupVisibility({ groupId: "group-1", db: fallback.db }),
		"public",
	);
});

test("getGroupMembership is read-only and returns null when none exists", async () => {
	const { db, createdMemberships } = createMockDb();

	assert.equal(
		await getGroupMembership({
			groupId: "group-1",
			userId: "user-1",
			db,
		}),
		null,
	);
	assert.equal(createdMemberships.length, 0);
});

test("ensureGroupMembership creates approved membership in automatic mode", async () => {
	const { db, createdMemberships } = createMockDb();

	const result = await ensureGroupMembership({
		groupId: "group-1",
		userId: "user-1",
		approvalMode: "automatic",
		db,
	});

	assert.equal(result.created, true);
	assert.deepEqual(result.membership, {
		role: "member",
		approvalStatus: "approved",
	});
	assert.equal(createdMemberships.length, 1);
	assert.equal(createdMemberships[0].groupId, "group-1");
	assert.equal(createdMemberships[0].principalId, "user-1");
	assert.equal(createdMemberships[0].approvalStatus, "approved");
});

test("ensureGroupMembership creates pending membership in manual mode", async () => {
	const { db, createdMemberships } = createMockDb();

	const result = await ensureGroupMembership({
		groupId: "group-1",
		userId: "user-1",
		approvalMode: "manual",
		db,
	});

	assert.equal(result.created, true);
	assert.deepEqual(result.membership, {
		role: "member",
		approvalStatus: "pending",
	});
	assert.equal(createdMemberships.length, 1);
	assert.equal(createdMemberships[0].approvalStatus, "pending");
});

test("ensureGroupMembership does not recreate existing membership", async () => {
	const { db, createdMemberships } = createMockDb({
		existingMembership: {
			id: "membership-1",
			role: "moderator",
			approvalStatus: "approved",
		},
	});

	const result = await ensureGroupMembership({
		groupId: "group-1",
		userId: "user-1",
		approvalMode: "automatic",
		db,
	});

	assert.equal(result.created, false);
	assert.deepEqual(result.membership, {
		role: "moderator",
		approvalStatus: "approved",
	});
	assert.equal(createdMemberships.length, 0);
});
