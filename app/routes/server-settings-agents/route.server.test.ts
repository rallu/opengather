import assert from "node:assert/strict";
import test from "node:test";
import {
	action,
	loader,
} from "./route.server.ts";

test("server-settings agents loader returns agents for admins", async () => {
	const result = await loader(
		{
			request: new Request("http://localhost:5173/server-settings/agents"),
			params: {},
			context: {},
			unstable_pattern: "",
		} as never,
		{
			resolveViewerRole: async () => ({
				authUser: {
					id: "user-1",
					name: "Admin",
					email: "admin@example.com",
				},
				viewerRole: "admin",
				setup: {
					isSetup: true,
					instance: {
						id: "instance-1",
						name: "OpenGather Local",
						visibilityMode: "public",
						approvalMode: "automatic",
					},
				},
			}),
			listAgents: async () => [
				{
					id: "agent-1",
					instanceId: "instance-1",
					createdByUserId: "user-1",
					displayName: "Codex",
					displayLabel: "Codex agent",
					description: null,
					role: "assistant",
					isEnabled: true,
					lastUsedAt: null,
					deletedAt: null,
					createdAt: new Date("2026-04-06T12:00:00.000Z"),
					updatedAt: new Date("2026-04-06T12:00:00.000Z"),
					grants: [
						{
							id: "grant-1",
							resourceType: "instance",
							resourceId: "instance-1",
							scope: "instance.feed.post",
							createdAt: new Date("2026-04-06T12:00:00.000Z"),
							updatedAt: new Date("2026-04-06T12:00:00.000Z"),
						},
					],
				},
			],
		},
	);

	assert.equal(result.viewerRole, "admin");
	assert.equal(result.baseUrl, "http://localhost:5173");
	assert.equal(result.agents.length, 1);
	assert.equal(result.agents[0]?.displayLabel, "Codex agent");
});

test("server-settings agents action creates a token and audits it", async () => {
	const auditCalls: unknown[] = [];
	const request = new Request("http://localhost:5173/server-settings/agents", {
		method: "POST",
		headers: {
			"content-type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			_action: "create-agent",
			displayName: "Codex",
			displayLabel: "Codex agent",
			instanceRole: "member",
			scope_instance_feed_read: "on",
			scope_instance_feed_post: "on",
		}),
	});

	const result = await action(
		{
			request,
			params: {},
			context: {},
			unstable_pattern: "",
		} as never,
		{
			resolveViewerRole: async () => ({
				authUser: {
					id: "user-1",
					name: "Admin",
					email: "admin@example.com",
				},
				viewerRole: "admin",
				setup: {
					isSetup: true,
					instance: {
						id: "instance-1",
						name: "OpenGather Local",
						visibilityMode: "public",
						approvalMode: "automatic",
					},
				},
			}),
			createAgent: async (params) => {
				assert.equal(params.instanceId, "instance-1");
				assert.equal(params.createdByUserId, "user-1");
				assert.deepEqual(params.grants, [
					{
						resourceType: "instance",
						resourceId: "instance-1",
						scope: "instance.feed.read",
					},
					{
						resourceType: "instance",
						resourceId: "instance-1",
						scope: "instance.feed.post",
					},
				]);
				return {
					agentId: "agent-1",
					token: "oga_created",
				};
			},
			writeAuditLog: async (params) => {
				auditCalls.push(params);
			},
		},
	);

	assert.deepEqual(result, {
		ok: true,
		action: "create-agent",
		agentId: "agent-1",
		token: "oga_created",
		baseUrl: "http://localhost:5173",
	});
	assert.equal(auditCalls.length, 1);
	assert.deepEqual(
		(auditCalls[0] as { action: string; resourceType: string; resourceId: string })
			.action,
		"agent.create",
	);
});

test("server-settings agents action disables an agent and audits it", async () => {
	const auditCalls: unknown[] = [];
	const disableCalls: unknown[] = [];
	const request = new Request("http://localhost:5173/server-settings/agents", {
		method: "POST",
		headers: {
			"content-type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			_action: "disable-agent",
			agentId: "agent-1",
		}),
	});

	const result = await action(
		{
			request,
			params: {},
			context: {},
			unstable_pattern: "",
		} as never,
		{
			resolveViewerRole: async () => ({
				authUser: {
					id: "user-1",
					name: "Admin",
					email: "admin@example.com",
				},
				viewerRole: "admin",
				setup: {
					isSetup: true,
					instance: {
						id: "instance-1",
						name: "OpenGather Local",
						visibilityMode: "public",
						approvalMode: "automatic",
					},
				},
			}),
			createAgent: async () => {
				throw new Error("createAgent should not be called");
			},
			disableAgent: async (params) => {
				disableCalls.push(params);
				return { agentId: "agent-1", disabled: true };
			},
			writeAuditLog: async (params) => {
				auditCalls.push(params);
			},
		},
	);

	assert.deepEqual(result, {
		ok: true,
		action: "disable-agent",
		agentId: "agent-1",
	});
	assert.deepEqual(disableCalls, [{ agentId: "agent-1" }]);
	assert.equal(
		(auditCalls[0] as { action: string }).action,
		"agent.disable",
	);
});

test("server-settings agents action rotates a token and audits it", async () => {
	const auditCalls: unknown[] = [];
	const rotateCalls: unknown[] = [];
	const request = new Request("http://localhost:5173/server-settings/agents", {
		method: "POST",
		headers: {
			"content-type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			_action: "rotate-agent",
			agentId: "agent-1",
		}),
	});

	const result = await action(
		{
			request,
			params: {},
			context: {},
			unstable_pattern: "",
		} as never,
		{
			resolveViewerRole: async () => ({
				authUser: {
					id: "user-1",
					name: "Admin",
					email: "admin@example.com",
				},
				viewerRole: "admin",
				setup: {
					isSetup: true,
					instance: {
						id: "instance-1",
						name: "OpenGather Local",
						visibilityMode: "public",
						approvalMode: "automatic",
					},
				},
			}),
			createAgent: async () => {
				throw new Error("createAgent should not be called");
			},
			disableAgent: async () => {
				throw new Error("disableAgent should not be called");
			},
			rotateAgentToken: async (params) => {
				rotateCalls.push(params);
				return { agentId: "agent-1", token: "oga_rotated" };
			},
			writeAuditLog: async (params) => {
				auditCalls.push(params);
			},
		},
	);

	assert.deepEqual(result, {
		ok: true,
		action: "rotate-agent",
		agentId: "agent-1",
		token: "oga_rotated",
		baseUrl: "http://localhost:5173",
	});
	assert.deepEqual(rotateCalls, [{ agentId: "agent-1" }]);
	assert.equal(
		(auditCalls[0] as { action: string }).action,
		"agent.rotate_secret",
	);
});
