import assert from "node:assert/strict";
import test from "node:test";
import { action, loader } from "./route.server.ts";

const REQUEST_URL =
	"http://localhost:5173/authorize?response_type=code&client_id=codex&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fcallback&code_challenge=challenge-123&code_challenge_method=S256&scope=instance.feed.read%20instance.feed.post&state=xyz";

function createViewer(role: "admin" | "member" = "admin") {
	return {
		authUser: {
			id: "user-1",
			name: "Admin",
			email: "admin@example.com",
		},
		viewerRole: role,
		setup: {
			isSetup: true,
			instance: {
				id: "instance-1",
				name: "OpenGather Local",
				visibilityMode: "public" as const,
				approvalMode: "automatic" as const,
			},
		},
	};
}

test("authorize loader redirects unauthenticated users to login", async () => {
	const result = await loader(
		{
			request: new Request(REQUEST_URL),
			params: {},
			context: {},
			unstable_pattern: "",
		} as never,
		{
			resolveViewer: async () => ({
				authUser: null,
				viewerRole: "guest",
				setup: { isSetup: false },
			}),
			listAgents: async () => [],
		},
	);

	assert.ok(result instanceof Response);
	assert.equal(result.status, 302);
	assert.match(
		result.headers.get("location") ?? "",
		/^\/login\?next=http%3A%2F%2Flocalhost%3A5173%2Fauthorize/,
	);
});

test("authorize loader returns consent data for admins", async () => {
	const result = await loader(
		{
			request: new Request(REQUEST_URL),
			params: {},
			context: {},
			unstable_pattern: "",
		} as never,
		{
			resolveViewer: async () => createViewer(),
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
							scope: "instance.feed.read",
							createdAt: new Date("2026-04-06T12:00:00.000Z"),
							updatedAt: new Date("2026-04-06T12:00:00.000Z"),
						},
					],
				},
			],
		},
	);

	assert.ok(!(result instanceof Response));
	assert.equal(result.oauth.clientId, "codex");
	assert.equal(result.oauth.redirectUri, "http://localhost:8080/callback");
	assert.deepEqual(result.oauth.scope, [
		"instance.feed.read",
		"instance.feed.post",
	]);
	assert.equal(result.agents.length, 1);
});

test("authorize action redirects with a code for an existing agent", async () => {
	const auditCalls: string[] = [];
	const request = new Request(REQUEST_URL, {
		method: "POST",
		headers: {
			"content-type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			decision: "approve",
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
			resolveViewer: async () => createViewer(),
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
							scope: "instance.feed.read",
							createdAt: new Date("2026-04-06T12:00:00.000Z"),
							updatedAt: new Date("2026-04-06T12:00:00.000Z"),
						},
						{
							id: "grant-2",
							resourceType: "instance",
							resourceId: "instance-1",
							scope: "instance.feed.post",
							createdAt: new Date("2026-04-06T12:00:00.000Z"),
							updatedAt: new Date("2026-04-06T12:00:00.000Z"),
						},
					],
				},
			],
			createAuthorizationCode: async (params) => {
				assert.equal(params.agentId, "agent-1");
				assert.equal(params.userId, "user-1");
				assert.equal(params.clientId, "codex");
				assert.equal(params.redirectUri, "http://localhost:8080/callback");
				return {
					code: "ogmcc_test",
					expiresAt: new Date("2026-04-06T12:05:00.000Z"),
				};
			},
			writeAuditLog: async (params) => {
				auditCalls.push(params.action);
			},
		},
	);

	assert.ok(result instanceof Response);
	assert.equal(result.status, 302);
	assert.equal(
		result.headers.get("location"),
		"http://localhost:8080/callback?code=ogmcc_test&state=xyz",
	);
	assert.deepEqual(auditCalls, ["agent.mcp.authorize"]);
});

test("authorize action can create a new agent before issuing a code", async () => {
	const auditCalls: string[] = [];
	const request = new Request(REQUEST_URL, {
		method: "POST",
		headers: {
			"content-type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			decision: "approve",
			agentId: "__new__",
			displayName: "Codex",
			displayLabel: "Codex MCP agent",
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
			resolveViewer: async () => createViewer(),
			listAgents: async () => [],
			createAgent: async (params) => {
				assert.equal(params.displayName, "Codex");
				assert.equal(params.instanceId, "instance-1");
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
					agentId: "agent-new",
					token: "oga_unused_here",
				};
			},
			createAuthorizationCode: async (params) => {
				assert.equal(params.agentId, "agent-new");
				return {
					code: "ogmcc_created",
					expiresAt: new Date("2026-04-06T12:05:00.000Z"),
				};
			},
			writeAuditLog: async (params) => {
				auditCalls.push(params.action);
			},
		},
	);

	assert.ok(result instanceof Response);
	assert.equal(result.status, 302);
	assert.equal(
		result.headers.get("location"),
		"http://localhost:8080/callback?code=ogmcc_created&state=xyz",
	);
	assert.deepEqual(auditCalls, ["agent.create", "agent.mcp.authorize"]);
});
