import assert from "node:assert/strict";
import test from "node:test";
import {
	createAgentGrantIndex,
	hasAgentGrantScope,
} from "./agent-permissions.server.ts";

test("createAgentGrantIndex groups grants by resource and deduplicates scopes", () => {
	const grantIndex = createAgentGrantIndex({
		grants: [
			{
				resourceType: "group",
				resourceId: "group-1",
				scope: "group.read",
			},
			{
				resourceType: "group",
				resourceId: "group-1",
				scope: "group.read",
			},
			{
				resourceType: "group",
				resourceId: "group-1",
				scope: "group.post",
			},
			{
				resourceType: "profile",
				resourceId: "user-1",
				scope: "profile.read.public",
			},
		],
	});

	assert.equal(
		hasAgentGrantScope({
			resourceScopes: grantIndex,
			resourceType: "group",
			resourceId: "group-1",
			scope: "group.read",
		}),
		true,
	);
	assert.equal(
		hasAgentGrantScope({
			resourceScopes: grantIndex,
			resourceType: "group",
			resourceId: "group-1",
			scope: "group.post",
		}),
		true,
	);
	assert.equal(
		hasAgentGrantScope({
			resourceScopes: grantIndex,
			resourceType: "group",
			resourceId: "group-2",
			scope: "group.read",
		}),
		false,
	);
	assert.equal(
		hasAgentGrantScope({
			resourceScopes: grantIndex,
			resourceType: "profile",
			resourceId: "user-1",
			scope: "profile.read.public",
		}),
		true,
	);
});
