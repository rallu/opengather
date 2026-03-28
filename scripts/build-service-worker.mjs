import path from "node:path";
import { fileURLToPath } from "node:url";
import { injectManifest } from "workbox-build";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

async function buildServiceWorker() {
	const { count, size, warnings } = await injectManifest({
		globDirectory: path.join(projectRoot, "build/client"),
		globPatterns: ["**/*.{css,ico,html,js,png,svg,webmanifest}"],
		globIgnores: ["service-worker.js"],
		maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
		swDest: path.join(projectRoot, "build/client/service-worker.js"),
		swSrc: path.join(projectRoot, "service-worker/sw.js"),
	});

	if (warnings.length > 0) {
		for (const warning of warnings) {
			console.warn(warning);
		}
	}

	console.log(
		`Built service worker with ${count} precached files (${size} bytes total).`,
	);
}

buildServiceWorker().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
