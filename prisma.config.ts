import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
	schema: "prisma/schema.prisma",
	datasource: {
		url:
			process.env.DATABASE_URL ??
			"postgres://opengather:opengather@127.0.0.1:5433/opengather",
	},
});
