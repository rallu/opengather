import assert from "node:assert/strict";
import test from "node:test";
import {
	canSubjectPostToGroup,
	canSubjectViewGroup,
	canSubjectViewInstanceFeed,
	canSubjectReplyToGroup,
	canSubjectViewProfile,
	createAgentGrantIndex,
	createAgentSubjectContext,
	createAnonymousSubjectContext,
	createUserSubjectContext,
	hasSubjectScope,
} from "../permissions.server.ts";

test("human subject contexts preserve existing read behavior", () => {
	const anonymous = createAnonymousSubjectContext();
	assert.deepEqual(
		canSubjectViewInstanceFeed({
			subjectContext: anonymous,
			visibilityMode: "registered",
		}),
		{ allowed: false, reason: "requires_authentication" },
	);

	const member = createUserSubjectContext({
		userId: "user-1",
		instanceRole: "member",
	});
	assert.deepEqual(
		canSubjectViewInstanceFeed({
			subjectContext: member,
			visibilityMode: "registered",
		}),
		{ allowed: true, reason: "allowed" },
	);
	assert.deepEqual(
		canSubjectViewProfile({
			subjectContext: member,
			targetUserId: "user-2",
			visibilityMode: "instance_members",
		}),
		{ allowed: true, reason: "allowed" },
	);
});

test("agent subject contexts require explicit scopes for allowed resources", () => {
	const agent = createAgentSubjectContext({
		agentId: "agent-1",
		instanceRole: "member",
		groupRoles: [["group-1", "member"]],
		scopes: ["instance.feed.read", "group.read"],
		resourceScopes: createAgentGrantIndex({
			grants: [
				{
					resourceType: "instance",
					resourceId: "instance-1",
					scope: "instance.feed.read",
				},
				{
					resourceType: "group",
					resourceId: "group-1",
					scope: "group.read",
				},
			],
		}),
	});

	assert.deepEqual(
		canSubjectViewInstanceFeed({
			subjectContext: agent,
			visibilityMode: "registered",
		}),
		{ allowed: true, reason: "allowed" },
	);
	assert.deepEqual(
		canSubjectViewGroup({
			subjectContext: agent,
			groupId: "group-1",
			visibilityMode: "group_members",
		}),
		{ allowed: true, reason: "allowed" },
	);
	assert.deepEqual(
		canSubjectPostToGroup({
			subjectContext: agent,
			groupId: "group-1",
		}),
		{ allowed: false, reason: "missing_scope" },
	);
	assert.deepEqual(
		canSubjectReplyToGroup({
			subjectContext: agent,
			groupId: "group-1",
		}),
		{ allowed: false, reason: "missing_scope" },
	);
});

test("agent subject contexts resolve group scopes per granted resource", () => {
	const agent = createAgentSubjectContext({
		agentId: "agent-4",
		instanceRole: "member",
		groupRoles: [
			["group-1", "member"],
			["group-2", "member"],
		],
		scopes: ["group.read"],
		resourceScopes: createAgentGrantIndex({
			grants: [
				{
					resourceType: "group",
					resourceId: "group-1",
					scope: "group.read",
				},
			],
		}),
	});

	assert.deepEqual(
		canSubjectViewGroup({
			subjectContext: agent,
			groupId: "group-1",
			visibilityMode: "group_members",
		}),
		{ allowed: true, reason: "allowed" },
	);
	assert.deepEqual(
		canSubjectViewGroup({
			subjectContext: agent,
			groupId: "group-2",
			visibilityMode: "group_members",
		}),
		{ allowed: false, reason: "missing_scope" },
	);
});

test("agent subject contexts cannot bypass structural access", () => {
	const agent = createAgentSubjectContext({
		agentId: "agent-2",
		instanceRole: "member",
		scopes: ["group.read", "profile.read.instance_members"],
	});

	assert.deepEqual(
		canSubjectViewGroup({
			subjectContext: agent,
			groupId: "group-2",
			visibilityMode: "private_invite_only",
		}),
		{ allowed: false, reason: "invite_required" },
	);
	assert.deepEqual(
		canSubjectViewProfile({
			subjectContext: agent,
			targetUserId: "user-9",
			visibilityMode: "private",
		}),
		{ allowed: false, reason: "private_profile" },
	);
});

test("hasSubjectScope applies only to agents", () => {
	const user = createUserSubjectContext({
		userId: "user-1",
		instanceRole: "member",
	});
	assert.equal(
		hasSubjectScope({
			subjectContext: user,
			scope: "group.post",
		}),
		true,
	);

	const agent = createAgentSubjectContext({
		agentId: "agent-3",
		instanceRole: "member",
		scopes: ["group.read"],
	});
	assert.equal(
		hasSubjectScope({
			subjectContext: agent,
			scope: "group.post",
		}),
		false,
	);
});
