import assert from "node:assert/strict";
import test from "node:test";
import {
	canAccessAuditLogs,
	resolveViewerRoleFromMembership,
} from "./viewer-role.service.server.ts";

test("resolveViewerRoleFromMembership returns guest for missing or unapproved membership", () => {
	assert.equal(resolveViewerRoleFromMembership(null), "guest");
	assert.equal(
		resolveViewerRoleFromMembership({
			role: "admin",
			approvalStatus: "pending",
		}),
		"guest",
	);
});

test("resolveViewerRoleFromMembership returns approved supported roles", () => {
	assert.equal(
		resolveViewerRoleFromMembership({
			role: "member",
			approvalStatus: "approved",
		}),
		"member",
	);
	assert.equal(
		resolveViewerRoleFromMembership({
			role: "moderator",
			approvalStatus: "approved",
		}),
		"moderator",
	);
	assert.equal(
		resolveViewerRoleFromMembership({
			role: "admin",
			approvalStatus: "approved",
		}),
		"admin",
	);
});

test("canAccessAuditLogs allows only admins", () => {
	assert.equal(canAccessAuditLogs({ viewerRole: "guest" }), false);
	assert.equal(canAccessAuditLogs({ viewerRole: "member" }), false);
	assert.equal(canAccessAuditLogs({ viewerRole: "moderator" }), false);
	assert.equal(canAccessAuditLogs({ viewerRole: "admin" }), true);
});
