import "dotenv/config";

import { createDb, ensureMemberships, ensureSeedUsers, resolveSetupInstanceId } from "./seed-test-environment/db";
import { SEED_USERS } from "./seed-test-environment/data";
import { seedPosts } from "./seed-test-environment/posts";

async function main() {
	const db = createDb();
	try {
		const instanceId = await resolveSetupInstanceId(db);
		await ensureSeedUsers(db);
		await ensureMemberships(db, instanceId);
		await seedPosts(db, instanceId);

		console.log("Seeded test environment successfully.");
		console.log("Users:");
		for (const user of SEED_USERS) {
			console.log(`- ${user.email} / ${user.password}`);
		}
	} finally {
		await db.$disconnect();
	}
}

main().catch((error) => {
	console.error(
		error instanceof Error ? error.message : "Failed to seed test environment",
	);
	process.exitCode = 1;
});
