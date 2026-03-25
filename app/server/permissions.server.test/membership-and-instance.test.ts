import assert from "node:assert/strict";
import test from "node:test";
import {
	canAccessAuditLogs,
	canManageInstance,
	canPostToInstanceFeed,
	canReplyToPost,
	canViewInstanceFeed,
	resolveGroupRoleFromMembership,
	resolveViewerRoleFromMembership,
} from "../permissions.server.ts";

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

test("resolveGroupRoleFromMembership supports owner and moderator roles", () => {
	assert.equal(resolveGroupRoleFromMembership(null), "guest");
	assert.equal(
		resolveGroupRoleFromMembership({
			role: "owner",
			approvalStatus: "approved",
		}),
		"owner",
	);
	assert.equal(
		resolveGroupRoleFromMembership({
			role: "moderator",
			approvalStatus: "approved",
		}),
		"moderator",
	);
});

test("canManageInstance and canAccessAuditLogs allow only admins", () => {
	assert.equal(canManageInstance({ viewerRole: "member" }).allowed, false);
	assert.equal(canManageInstance({ viewerRole: "admin" }).allowed, true);
	assert.equal(canAccessAuditLogs({ viewerRole: "moderator" }).allowed, false);
	assert.equal(canAccessAuditLogs({ viewerRole: "admin" }).allowed, true);
});

test("canViewInstanceFeed handles public, registered, and approval access", () => {
	assert.deepEqual(
		canViewInstanceFeed({
			visibilityMode: "public",
			viewerRole: "guest",
			isAuthenticated: false,
		}),
		{ allowed: true, reason: "allowed" },
	);
	assert.deepEqual(
		canViewInstanceFeed({
			visibilityMode: "registered",
			viewerRole: "guest",
			isAuthenticated: false,
		}),
		{ allowed: false, reason: "requires_authentication" },
	);
	assert.deepEqual(
		canViewInstanceFeed({
			visibilityMode: "registered",
			viewerRole: "member",
			isAuthenticated: true,
		}),
		{ allowed: true, reason: "allowed" },
	);
	assert.deepEqual(
		canViewInstanceFeed({
			visibilityMode: "approval",
			viewerRole: "guest",
			isAuthenticated: true,
		}),
		{ allowed: false, reason: "pending_membership" },
	);
});

test("canPostToInstanceFeed and canReplyToPost require membership", () => {
	assert.equal(canPostToInstanceFeed({ viewerRole: "guest" }).allowed, false);
	assert.equal(canPostToInstanceFeed({ viewerRole: "member" }).allowed, true);
	assert.equal(canReplyToPost({ viewerRole: "guest" }).allowed, false);
	assert.equal(canReplyToPost({ viewerRole: "moderator" }).allowed, true);
});
