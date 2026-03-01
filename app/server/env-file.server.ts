import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function getEnvFilePath(): string {
	return path.resolve(process.cwd(), ".env");
}

export async function persistDatabaseUrlToEnv(params: {
	databaseUrl: string;
}): Promise<void> {
	const envPath = getEnvFilePath();
	let existing = "";
	try {
		existing = await readFile(envPath, "utf8");
	} catch {
		existing = "";
	}

	const lines = existing.split(/\r?\n/).filter((line) => line.length > 0);
	const nextEntry = `DATABASE_URL=${params.databaseUrl}`;
	const withoutDb = lines.filter((line) => !line.startsWith("DATABASE_URL="));
	withoutDb.push(nextEntry);
	await writeFile(envPath, `${withoutDb.join("\n")}\n`, "utf8");
}
