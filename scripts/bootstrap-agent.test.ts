import assert from "node:assert/strict";
import test from "node:test";
import { parseAgentBootstrapArgs } from "./bootstrap-agent.ts";

test("parseAgentBootstrapArgs parses create arguments", () => {
	const parsed = parseAgentBootstrapArgs([
		"create",
		"--display-name",
		"Codex",
		"--instance-role",
		"member",
		"--group",
		"group-1:member",
		"--grant",
		"group:group-1:group.post",
	]);

	assert.deepEqual(parsed, {
		command: "create",
		displayName: "Codex",
		displayLabel: undefined,
		description: undefined,
		role: undefined,
		instanceId: undefined,
		createdByUserId: undefined,
		instanceRole: "member",
		groupMemberships: [
			{
				groupId: "group-1",
				role: "member",
			},
		],
		grants: [
			{
				resourceType: "group",
				resourceId: "group-1",
				scope: "group.post",
			},
		],
	});
});

test("parseAgentBootstrapArgs parses rotate and disable commands", () => {
	assert.deepEqual(parseAgentBootstrapArgs(["rotate", "--agent-id", "agent-1"]), {
		command: "rotate",
		agentId: "agent-1",
	});
	assert.deepEqual(parseAgentBootstrapArgs(["disable", "--agent-id", "agent-1"]), {
		command: "disable",
		agentId: "agent-1",
	});
});

test("parseAgentBootstrapArgs returns help for no command", () => {
	assert.deepEqual(parseAgentBootstrapArgs([]), {
		command: "help",
	});
});
