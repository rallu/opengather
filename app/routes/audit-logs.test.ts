import assert from "node:assert/strict";
import test from "node:test";
import { loadAuditLogs } from "./audit-logs.server.ts";

test("loadAuditLogs returns unauthenticated state with parsed filters", async () => {
	const result = await loadAuditLogs(
		new Request(
			"http://localhost:5173/audit-logs?actorType=agent&actorId=agent-1",
		),
		{
			getViewer: async () => ({
				authUser: null,
				setup: { isSetup: false },
				viewerRole: "guest",
			}),
			findLogs: async () => [],
		},
	);

	assert.equal(result.status, "unauthenticated");
	assert.equal(result.filters.actorType, "agent");
	assert.equal(result.filters.actorId, "agent-1");
});

test("loadAuditLogs applies actor and resource filters and formats labels", async () => {
	const findLogCalls: unknown[] = [];
	const result = await loadAuditLogs(
		new Request(
			"http://localhost:5173/audit-logs?actorType=agent&actorId=agent-1&resourceType=post&resourceId=post-1&action=agent.post.hide",
		),
		{
			getViewer: async () => ({
				authUser: {
					id: "user-1",
					name: "Admin",
					email: "admin@example.com",
				},
				setup: {
					isSetup: true,
					instance: {
						id: "instance-1",
						name: "OpenGather Local",
						visibilityMode: "public",
						approvalMode: "automatic",
					},
				},
				viewerRole: "admin",
			}),
			findLogs: async (params) => {
				findLogCalls.push(params);
				return [
					{
						id: "log-1",
						createdAt: new Date("2026-04-06T12:00:00.000Z"),
						action: "agent.post.hide",
						actorId: "agent-1",
						actorType: "agent",
						resourceType: "post",
						resourceId: "post-1",
						payload: { reason: "agent-hide-post" },
					},
				];
			},
		},
	);

	assert.equal(result.status, "ok");
	assert.deepEqual(findLogCalls, [
		{
			where: {
				actorType: "agent",
				actorId: "agent-1",
				resourceType: "post",
				resourceId: "post-1",
				action: "agent.post.hide",
			},
		},
	]);
	assert.equal(result.logs.length, 1);
	assert.equal(result.logs[0]?.actorLabel, "Agent:agent-1");
	assert.equal(result.logs[0]?.resourceLabel, "post:post-1");
	assert.equal(
		result.logs[0]?.payloadText,
		JSON.stringify({ reason: "agent-hide-post" }),
	);
});
