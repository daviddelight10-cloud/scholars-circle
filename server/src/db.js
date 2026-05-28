import { PrismaClient } from "@prisma/client";

const globalForPrisma = global;

// Add connection pool parameters to DATABASE_URL to prevent connection exhaustion
const connectionString = process.env.DATABASE_URL;
const connectionUrl = connectionString
  ? connectionString.includes('connection_limit')
    ? connectionString
    : `${connectionString}?connection_limit=5&pool_timeout=10`
  : undefined;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: connectionUrl,
      },
    },
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
