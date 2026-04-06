// src/lib/prisma.js
// Singleton do PrismaClient para Prisma v7.6.0
// O adapter é obrigatório nessa versão — passa a URL via pg.Pool

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

function createPrismaClient() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
}

// Singleton: reutiliza a instância em desenvolvimento (evita conexões em excesso com hot-reload)
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
