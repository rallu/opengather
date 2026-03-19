import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
	buildDevToolsWorkspaceManifest,
	DEVTOOLS_WORKSPACE_UUID,
} from "./devtools-workspace.server.ts";

test("buildDevToolsWorkspaceManifest returns manifest for localhost in development", () => {
	const manifest = buildDevToolsWorkspaceManifest({
		request: new Request(
			"http://localhost:5173/.well-known/appspecific/com.chrome.devtools.json",
		),
		nodeEnv: "development",
	});

	assert.deepEqual(manifest, {
		workspace: {
			root: path.resolve(process.cwd()),
			uuid: DEVTOOLS_WORKSPACE_UUID,
		},
	});
});

test("buildDevToolsWorkspaceManifest returns manifest for loopback IPs", () => {
	const manifest = buildDevToolsWorkspaceManifest({
		request: new Request(
			"http://127.0.0.1:5173/.well-known/appspecific/com.chrome.devtools.json",
		),
		nodeEnv: "test",
		workspaceUuid: "11111111-1111-4111-8111-111111111111",
		moduleUrl:
			"file:///workspace/opengather/app/server/devtools-workspace.server.ts",
	});

	assert.deepEqual(manifest, {
		workspace: {
			root: "/workspace/opengather",
			uuid: "11111111-1111-4111-8111-111111111111",
		},
	});
});

test("buildDevToolsWorkspaceManifest is disabled in production", () => {
	const manifest = buildDevToolsWorkspaceManifest({
		request: new Request(
			"http://localhost:5173/.well-known/appspecific/com.chrome.devtools.json",
		),
		nodeEnv: "production",
	});

	assert.equal(manifest, null);
});

test("buildDevToolsWorkspaceManifest is disabled for non-local hosts", () => {
	const manifest = buildDevToolsWorkspaceManifest({
		request: new Request(
			"http://192.168.1.10:5173/.well-known/appspecific/com.chrome.devtools.json",
		),
		nodeEnv: "development",
	});

	assert.equal(manifest, null);
});
