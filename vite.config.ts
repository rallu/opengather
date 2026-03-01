import path from "node:path";
import { fileURLToPath } from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import { cloudflareDevProxy } from "@react-router/dev/vite/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ isSsrBuild }) => ({
	build: {
		rollupOptions: isSsrBuild
			? {
					input: "./workers/app.ts",
				}
			: undefined,
	},
	resolve: {
		alias: {
			"~": path.resolve(__dirname, "./app"),
		},
	},
	server: {
		port: 5173,
		host: true,
	},
	plugins: [
		cloudflareDevProxy({
			getLoadContext({ context }) {
				return { cloudflare: context.cloudflare };
			},
		}),
		tailwindcss(),
		reactRouter(),
		tsconfigPaths(),
	],
}));
