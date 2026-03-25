import { spawn } from "node:child_process";

export async function runCommand(
	command: string,
	args: string[],
): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stderr = "";

		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(
				new Error(`${command} exited with code ${code}: ${stderr.trim()}`),
			);
		});
	});
}

export async function runCommandJson<T>(
	command: string,
	args: string[],
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code !== 0) {
				reject(
					new Error(`${command} exited with code ${code}: ${stderr.trim()}`),
				);
				return;
			}

			try {
				resolve(JSON.parse(stdout) as T);
			} catch (error) {
				reject(error);
			}
		});
	});
}
