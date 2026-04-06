import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma v7.6.0: defineConfig aceita apenas schema e migrations.
// O adapter (conexão com o banco) vai no PrismaClient em runtime.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});
