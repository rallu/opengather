import { createRequestHandler, type ServerBuild } from "react-router";
import { setRuntimeEnv } from "~/server/env.server";

declare global {
	interface CloudflareEnvironment extends Env {}
}

declare module "react-router" {
	export interface AppLoadContext {
		cloudflare: {
			env: CloudflareEnvironment;
			ctx: ExecutionContext;
		};
	}
}

const requestHandler = createRequestHandler(
	async () =>
		(await import(
			"virtual:react-router/server-build"
		)) as unknown as ServerBuild,
	import.meta.env.MODE,
);

export default {
	fetch(request, env, ctx) {
		setRuntimeEnv(env);
		return requestHandler(request, {
			cloudflare: { env, ctx },
		});
	},
} satisfies ExportedHandler<CloudflareEnvironment>;
