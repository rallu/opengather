import assert from "node:assert/strict";
import test from "node:test";
import { writeAuditLog } from "./audit-log.service.server.ts";

test("writeAuditLog creates entry with actor/action/resource/payload", async () => {
	const created: unknown[] = [];
	const fakeDb = {
		auditLog: {
			create: async (args: unknown) => {
				created.push(args);
				return args;
			},
		},
	};

	const request = new Request("http://localhost:5173/server-settings", {
		method: "POST",
		headers: {
			"x-forwarded-for": "203.0.113.9, 10.0.0.1",
			"user-agent": "node-test",
		},
	});

	await writeAuditLog({
		action: "server_settings.hub_connection_updated",
		actor: {
			type: "user",
			id: "user-1",
		},
		resourceType: "server_settings",
		resourceId: "hub_connection",
		payload: { outcome: "success" },
		request,
		db: fakeDb,
		instanceId: "singleton",
	});

	assert.equal(created.length, 1);
	const [first] = created as Array<{ data: Record<string, unknown> }>;
	assert.equal(first.data.instanceId, "singleton");
	assert.equal(first.data.actorId, "user-1");
	assert.equal(first.data.actorType, "user");
	assert.equal(first.data.action, "server_settings.hub_connection_updated");
	assert.equal(first.data.resourceType, "server_settings");
	assert.equal(first.data.resourceId, "hub_connection");

	const payload = first.data.payload as Record<string, unknown>;
	assert.equal(payload.outcome, "success");
	const requestPayload = payload.request as Record<string, unknown>;
	assert.equal(requestPayload.method, "POST");
	assert.equal(requestPayload.path, "/server-settings");
	assert.equal(requestPayload.ip, "203.0.113.9");
	assert.equal(requestPayload.userAgent, "node-test");
});

test("writeAuditLog accepts agent actors", async () => {
	const created: unknown[] = [];
	const fakeDb = {
		auditLog: {
			create: async (args: unknown) => {
				created.push(args);
				return args;
			},
		},
	};

	await writeAuditLog({
		action: "agent.post.create",
		actor: {
			type: "agent",
			id: "agent-1",
		},
		resourceType: "post",
		resourceId: "post-1",
		payload: { scope: "group.post" },
		db: fakeDb,
		instanceId: "singleton",
	});

	assert.equal(created.length, 1);
	const [first] = created as Array<{ data: Record<string, unknown> }>;
	assert.equal(first.data.actorId, "agent-1");
	assert.equal(first.data.actorType, "agent");
	assert.equal(first.data.action, "agent.post.create");
});
