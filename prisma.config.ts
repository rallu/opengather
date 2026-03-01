import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
	schema: "prisma/schema.prisma",
	datasource: {
		url:
			process.env.DATABASE_URL ??
			"postgres://opengather:opengather@localhost:5432/opengather",
	},
});
