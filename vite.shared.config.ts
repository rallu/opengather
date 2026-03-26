import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"~": path.resolve(__dirname, "./app"),
		},
	},
	build: {
		outDir: "dist",
		emptyOutDir: true,
		minify: false,
		sourcemap: true,
		rollupOptions: {
			preserveEntrySignatures: "strict",
			input: {
				ui: path.resolve(__dirname, "./ui.ts"),
				post: path.resolve(__dirname, "./post.ts"),
				"rich-text": path.resolve(__dirname, "./rich-text.ts"),
				utils: path.resolve(__dirname, "./utils.ts"),
			},
			external: [
				"@radix-ui/react-slot",
				"class-variance-authority",
				"clsx",
				"lucide-react",
				"react",
				"react-dom",
				"tailwind-merge",
			],
			output: {
				format: "es",
				entryFileNames: "[name].js",
				chunkFileNames: "chunks/[name]-[hash].js",
			},
		},
	},
});
