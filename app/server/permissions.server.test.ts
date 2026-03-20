import assert from "node:assert/strict";
import test from "node:test";
import {
	canAccessAuditLogs,
	canJoinGroup,
	canManageGroup,
	canManageInstance,
	canParticipateInEvent,
	canPostToGroup,
	canPostToInstanceFeed,
	canReplyToPost,
	canViewEvent,
	canViewGroup,
	canViewInstanceFeed,
	canViewProfile,
	getAllowedProfileVisibilityModes,
	resolveEffectiveProfileVisibility,
	resolveEventVisibilityMode,
	resolveGroupRoleFromMembership,
	resolveViewerRoleFromMembership,
} from "./permissions.server.ts";

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

test("canViewGroup evaluates group visibility against instance and group roles", () => {
	assert.deepEqual(
		canViewGroup({
			isAuthenticated: false,
			instanceViewerRole: "guest",
			groupRole: "guest",
			visibilityMode: "public",
		}),
		{ allowed: true, reason: "allowed" },
	);
	assert.deepEqual(
		canViewGroup({
			isAuthenticated: true,
			instanceViewerRole: "member",
			groupRole: "guest",
			visibilityMode: "instance_members",
		}),
		{ allowed: true, reason: "allowed" },
	);
	assert.deepEqual(
		canViewGroup({
			isAuthenticated: true,
			instanceViewerRole: "member",
			groupRole: "guest",
			visibilityMode: "group_members",
		}),
		{ allowed: false, reason: "group_membership_required" },
	);
	assert.deepEqual(
		canViewGroup({
			isAuthenticated: true,
			instanceViewerRole: "member",
			groupRole: "owner",
			visibilityMode: "private_invite_only",
		}),
		{ allowed: true, reason: "allowed" },
	);
});

test("canJoinGroup respects authentication, current access, and invite-only groups", () => {
	assert.deepEqual(
		canJoinGroup({
			isAuthenticated: false,
			instanceViewerRole: "guest",
			groupRole: "guest",
			visibilityMode: "public",
		}),
		{ allowed: false, reason: "requires_authentication" },
	);
	assert.deepEqual(
		canJoinGroup({
			isAuthenticated: true,
			instanceViewerRole: "member",
			groupRole: "guest",
			visibilityMode: "group_members",
		}),
		{ allowed: true, reason: "allowed" },
	);
	assert.deepEqual(
		canJoinGroup({
			isAuthenticated: true,
			instanceViewerRole: "member",
			groupRole: "member",
			visibilityMode: "group_members",
		}),
		{ allowed: false, reason: "already_has_access" },
	);
	assert.deepEqual(
		canJoinGroup({
			isAuthenticated: true,
			instanceViewerRole: "member",
			groupRole: "guest",
			visibilityMode: "private_invite_only",
		}),
		{ allowed: false, reason: "invite_required" },
	);
});

test("canPostToGroup requires approved group membership", () => {
	assert.equal(canPostToGroup({ groupRole: "guest" }).allowed, false);
	assert.equal(canPostToGroup({ groupRole: "member" }).allowed, true);
	assert.equal(canPostToGroup({ groupRole: "owner" }).allowed, true);
});

test("canManageGroup requires moderator, admin, or owner", () => {
	assert.equal(canManageGroup({ groupRole: "guest" }).allowed, false);
	assert.equal(canManageGroup({ groupRole: "member" }).allowed, false);
	assert.equal(canManageGroup({ groupRole: "moderator" }).allowed, true);
	assert.equal(canManageGroup({ groupRole: "owner" }).allowed, true);
});

test("resolveEventVisibilityMode inherits from group visibility", () => {
	assert.equal(
		resolveEventVisibilityMode({
			visibilityMode: "inherit",
			groupVisibilityMode: "group_members",
		}),
		"group_members",
	);
	assert.equal(
		resolveEventVisibilityMode({
			visibilityMode: "inherit",
			groupVisibilityMode: "private_invite_only",
		}),
		"private_invite_only",
	);
	assert.equal(
		resolveEventVisibilityMode({
			visibilityMode: "public",
			groupVisibilityMode: "group_members",
		}),
		"public",
	);
});

test("canViewEvent handles participant and invite-only visibility", () => {
	assert.deepEqual(
		canViewEvent({
			isAuthenticated: true,
			instanceViewerRole: "member",
			groupRole: "guest",
			visibilityMode: "participants",
			partcipationStatus: "approved",
		}),
		{ allowed: true, reason: "allowed" },
	);
	assert.deepEqual(
		canViewEvent({
			isAuthenticated: true,
			instanceViewerRole: "member",
			groupRole: "guest",
			visibilityMode: "participants",
			partcipationStatus: "none",
		}),
		{ allowed: false, reason: "participant_required" },
	);
	assert.deepEqual(
		canViewEvent({
			isAuthenticated: true,
			instanceViewerRole: "member",
			groupRole: "owner",
			visibilityMode: "private_invite_only",
			partcipationStatus: "none",
		}),
		{ allowed: true, reason: "allowed" },
	);
});

test("canParticipateInEvent handles open and invite-only flows", () => {
	assert.deepEqual(
		canParticipateInEvent({
			isAuthenticated: true,
			instanceViewerRole: "member",
			groupRole: "guest",
			visibilityMode: "participants",
			partcipationStatus: "none",
		}),
		{ allowed: true, reason: "allowed" },
	);
	assert.deepEqual(
		canParticipateInEvent({
			isAuthenticated: true,
			instanceViewerRole: "member",
			groupRole: "guest",
			visibilityMode: "private_invite_only",
			partcipationStatus: "none",
		}),
		{ allowed: false, reason: "invite_required" },
	);
	assert.deepEqual(
		canParticipateInEvent({
			isAuthenticated: true,
			instanceViewerRole: "member",
			groupRole: "guest",
			visibilityMode: "private_invite_only",
			partcipationStatus: "invited",
		}),
		{ allowed: true, reason: "allowed" },
	);
});

test("canViewProfile handles self, public, members-only, and private profiles", () => {
	assert.deepEqual(
		canViewProfile({
			isAuthenticated: false,
			isSelf: true,
			instanceViewerRole: "guest",
			visibilityMode: "private",
		}),
		{ allowed: true, reason: "allowed" },
	);
	assert.deepEqual(
		canViewProfile({
			isAuthenticated: false,
			isSelf: false,
			instanceViewerRole: "guest",
			visibilityMode: "public",
		}),
		{ allowed: true, reason: "allowed" },
	);
	assert.deepEqual(
		canViewProfile({
			isAuthenticated: true,
			isSelf: false,
			instanceViewerRole: "member",
			visibilityMode: "instance_members",
		}),
		{ allowed: true, reason: "allowed" },
	);
	assert.deepEqual(
		canViewProfile({
			isAuthenticated: true,
			isSelf: false,
			instanceViewerRole: "guest",
			visibilityMode: "private",
		}),
		{ allowed: false, reason: "private_profile" },
	);
});

test("profile visibility options and effective visibility follow instance visibility", () => {
	assert.deepEqual(
		getAllowedProfileVisibilityModes({
			instanceVisibilityMode: "public",
		}),
		["public", "instance_members", "private"],
	);
	assert.deepEqual(
		getAllowedProfileVisibilityModes({
			instanceVisibilityMode: "registered",
		}),
		["instance_members", "private"],
	);
	assert.equal(
		resolveEffectiveProfileVisibility({
			instanceVisibilityMode: "approval",
			visibilityMode: "public",
		}),
		"instance_members",
	);
	assert.equal(
		resolveEffectiveProfileVisibility({
			instanceVisibilityMode: "public",
			visibilityMode: "public",
		}),
		"public",
	);
});
