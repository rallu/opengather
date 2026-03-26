import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma-node/client.ts";
import { SEED_USERS } from "./data.ts";

export function createDb() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("DATABASE_URL is not configured.");
	}

	const adapter = new PrismaPg({ connectionString: databaseUrl });
	return new PrismaClient({ adapter });
}

export async function resolveSetupInstanceId(
	db: PrismaClient,
): Promise<string> {
	const rows = await db.config.findMany({
		where: {
			key: {
				in: ["setup_completed", "setup_instance_id"],
			},
		},
	});

	const completedRow = rows.find((row) => row.key === "setup_completed");
	const instanceRow = rows.find((row) => row.key === "setup_instance_id");

	if (!completedRow || completedRow.value !== true || !instanceRow) {
		throw new Error(
			"OpenGather setup is incomplete. Complete /setup first, then run this seed script.",
		);
	}

	if (typeof instanceRow.value !== "string" || instanceRow.value.length === 0) {
		throw new Error("Invalid setup_instance_id config value.");
	}

	return instanceRow.value;
}

export async function ensureSeedUsers(db: PrismaClient) {
	const now = new Date();

	for (const seedUser of SEED_USERS) {
		await db.user.upsert({
			where: { email: seedUser.email },
			create: {
				id: seedUser.id,
				name: seedUser.name,
				email: seedUser.email,
				emailVerified: true,
				image: null,
				createdAt: now,
				updatedAt: now,
			},
			update: {
				name: seedUser.name,
				emailVerified: true,
				updatedAt: now,
			},
		});
	}
}

export async function ensureMemberships(db: PrismaClient, instanceId: string) {
	const now = new Date();

	await Promise.all(
		SEED_USERS.map((seedUser) =>
			db.instanceMembership.upsert({
				where: {
					instanceId_principalId_principalType: {
						instanceId,
						principalId: seedUser.id,
						principalType: "user",
					},
				},
				create: {
					id: randomUUID(),
					instanceId,
					principalId: seedUser.id,
					principalType: "user",
					role: "member",
					approvalStatus: "approved",
					createdAt: now,
					updatedAt: now,
				},
				update: {
					role: "member",
					approvalStatus: "approved",
					updatedAt: now,
				},
			}),
		),
	);
}
