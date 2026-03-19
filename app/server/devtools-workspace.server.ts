import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEVTOOLS_WORKSPACE_UUID = "dab177b8-c7a9-4390-a3f8-7194c04bd118";

const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export type DevToolsWorkspaceManifest = {
	workspace: {
		root: string;
		uuid: string;
	};
};

type BuildDevToolsWorkspaceManifestOptions = {
	request: Request;
	nodeEnv?: string | undefined;
	moduleUrl?: string;
	workspaceUuid?: string;
};

export function buildDevToolsWorkspaceManifest(
	options: BuildDevToolsWorkspaceManifestOptions,
): DevToolsWorkspaceManifest | null {
	if (!isAutomaticWorkspaceEnabled(options.request, options.nodeEnv)) {
		return null;
	}

	return {
		workspace: {
			root: resolveProjectRoot(options.moduleUrl),
			uuid: options.workspaceUuid ?? DEVTOOLS_WORKSPACE_UUID,
		},
	};
}

function isAutomaticWorkspaceEnabled(
	request: Request,
	nodeEnv = process.env.NODE_ENV,
): boolean {
	if (nodeEnv === "production") {
		return false;
	}

	const url = new URL(request.url);
	return LOCALHOST_HOSTNAMES.has(url.hostname);
}

function resolveProjectRoot(moduleUrl = import.meta.url): string {
	return path.resolve(path.dirname(fileURLToPath(moduleUrl)), "../..");
}
