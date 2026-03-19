import type { LoaderFunctionArgs } from "react-router";

import { buildDevToolsWorkspaceManifest } from "~/server/devtools-workspace.server";

export async function loader({ request }: LoaderFunctionArgs) {
	const manifest = buildDevToolsWorkspaceManifest({ request });

	if (!manifest) {
		return new Response(null, {
			status: 404,
			headers: {
				"Cache-Control": "no-store",
			},
		});
	}

	return new Response(JSON.stringify(manifest), {
		status: 200,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "no-store",
		},
	});
}

export default function ChromeDevToolsWorkspaceRoute() {
	return null;
}
