import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { getDatabaseEnv, hasDatabaseConfig } from "./env.server";

let prismaSingleton: PrismaClient | null = null;

export function getDb(): PrismaClient {
	if (prismaSingleton) {
		return prismaSingleton;
	}

	if (!hasDatabaseConfig()) {
		throw new Error("DATABASE_URL is not configured");
	}

	const adapter = new PrismaPg({
		connectionString: getDatabaseEnv().DATABASE_URL,
	});
	prismaSingleton = new PrismaClient({ adapter });
	return prismaSingleton;
}
