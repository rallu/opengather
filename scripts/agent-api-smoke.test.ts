import assert from "node:assert/strict";
import test from "node:test";
import { parseAgentApiSmokeArgs } from "./agent-api-smoke.ts";

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
