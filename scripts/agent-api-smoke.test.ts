import assert from "node:assert/strict";
import test from "node:test";
import {
	parseAgentApiSmokeArgs,
	runAgentApiSmoke,
} from "./agent-api-smoke.ts";

test("parseAgentApiSmokeArgs parses a feed smoke run", () => {
	assert.deepEqual(
		parseAgentApiSmokeArgs([
			"--base-url",
			"http://localhost:5173/",
			"--token",
			"oga_test",
			"--body",
			"hello from codex",
		]),
		{
			command: "run",
			baseUrl: "http://localhost:5173",
			token: "oga_test",
			groupId: undefined,
			bodyText: "hello from codex",
			skipWrite: false,
			forbiddenPath: undefined,
			forbiddenStatus: 403,
		},
	);
});

test("parseAgentApiSmokeArgs parses group target and skip-write mode", () => {
	assert.deepEqual(
		parseAgentApiSmokeArgs([
			"--base-url",
			"http://localhost:5173",
			"--token",
			"oga_test",
			"--group-id",
			"group-1",
			"--skip-write",
		]),
		{
			command: "run",
			baseUrl: "http://localhost:5173",
			token: "oga_test",
			groupId: "group-1",
			bodyText: "Codex smoke test post",
			skipWrite: true,
			forbiddenPath: undefined,
			forbiddenStatus: 403,
		},
	);
});

test("parseAgentApiSmokeArgs parses forbidden-route expectations", () => {
	assert.deepEqual(
		parseAgentApiSmokeArgs([
			"--base-url",
			"http://localhost:5173",
			"--token",
			"oga_test",
			"--forbidden-path",
			"/api/agents/v1/groups/group-2/posts",
			"--forbidden-status",
			"403",
		]),
		{
			command: "run",
			baseUrl: "http://localhost:5173",
			token: "oga_test",
			groupId: undefined,
			bodyText: "Codex smoke test post",
			skipWrite: false,
			forbiddenPath: "/api/agents/v1/groups/group-2/posts",
			forbiddenStatus: 403,
		},
	);
});

test("parseAgentApiSmokeArgs returns help and validates required flags", () => {
	assert.deepEqual(parseAgentApiSmokeArgs(["--help"]), {
		command: "help",
	});
	assert.throws(
		() =>
			parseAgentApiSmokeArgs([
				"--base-url",
				"http://localhost:5173",
			]),
		/--token is required/,
	);
});

test("runAgentApiSmoke validates me, groups, allowed write, and forbidden route", async () => {
	const requests: Array<{
		url: string;
		method: string;
		body: string | undefined;
	}> = [];

	const result = await runAgentApiSmoke({
		command: {
			command: "run",
			baseUrl: "http://localhost:5173",
			token: "oga_test",
			bodyText: "hello from codex",
			skipWrite: false,
			forbiddenPath: "/api/agents/v1/groups/group-2/posts",
			forbiddenStatus: 403,
		},
		fetchFn: async (input, init) => {
			const url = String(input);
			requests.push({
				url,
				method: init?.method ?? "GET",
				body: typeof init?.body === "string" ? init.body : undefined,
			});
			if (url.endsWith("/api/agents/v1/me")) {
				return new Response(JSON.stringify({ ok: true, data: { id: "agent-1" } }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}
			if (url.endsWith("/api/agents/v1/groups")) {
				return new Response(JSON.stringify({ ok: true, data: [] }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}
			if (url.endsWith("/api/agents/v1/feed/posts")) {
				return new Response(JSON.stringify({ ok: true, data: { id: "post-1" } }), {
					status: 201,
					headers: { "content-type": "application/json" },
				});
			}
			if (url.endsWith("/api/agents/v1/groups/group-2/posts")) {
				return new Response(
					JSON.stringify({
						ok: false,
						error: { code: "forbidden", message: "nope" },
					}),
					{
						status: 403,
						headers: { "content-type": "application/json" },
					},
				);
			}
			throw new Error(`Unexpected URL: ${url}`);
		},
	});

	assert.deepEqual(result, {
		ok: true,
		me: { ok: true, data: { id: "agent-1" } },
		groups: { ok: true, data: [] },
		write: { ok: true, data: { id: "post-1" } },
		forbidden: {
			ok: false,
			error: { code: "forbidden", message: "nope" },
		},
	});
	assert.deepEqual(requests, [
		{
			url: "http://localhost:5173/api/agents/v1/me",
			method: "GET",
			body: undefined,
		},
		{
			url: "http://localhost:5173/api/agents/v1/groups",
			method: "GET",
			body: undefined,
		},
		{
			url: "http://localhost:5173/api/agents/v1/feed/posts",
			method: "POST",
			body: JSON.stringify({ bodyText: "hello from codex" }),
		},
		{
			url: "http://localhost:5173/api/agents/v1/groups/group-2/posts",
			method: "POST",
			body: JSON.stringify({ bodyText: "hello from codex" }),
		},
	]);
});
