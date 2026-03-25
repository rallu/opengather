import assert from "node:assert/strict";
import test from "node:test";
import {
	canViewProfile,
	getAllowedProfileVisibilityModes,
	resolveEffectiveProfileVisibility,
} from "../permissions.server.ts";

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
