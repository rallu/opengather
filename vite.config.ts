import path from "node:path";
import { fileURLToPath } from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"~": path.resolve(__dirname, "./app"),
		},
	},
	server: {
		port: 5173,
		host: true,
	},
	plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
});
