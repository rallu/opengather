import assert from "node:assert/strict";
import test from "node:test";
import {
	canJoinGroup,
	canManageGroup,
	canParticipateInEvent,
	canPostToGroup,
	canViewEvent,
	canViewGroup,
	resolveEventVisibilityMode,
} from "../permissions.server.ts";

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
