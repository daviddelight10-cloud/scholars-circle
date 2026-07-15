import { PrismaClient } from "@prisma/client";

const globalForPrisma = global;

// Add connection pool parameters to DATABASE_URL to prevent connection exhaustion
const connectionString = process.env.DATABASE_URL;
const connectionUrl = connectionString
  ? connectionString.includes('connection_limit')
    ? connectionString
    : `${connectionString}?connection_limit=3&pool_timeout=20`
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

// Lazy connection - don't connect on startup, connect on first query
let isConnected = false;
export const ensureConnection = async () => {
  if (!isConnected) {
    try {
      await prisma.$connect();
      isConnected = true;
      console.log("Database connected successfully");
    } catch (err) {
      console.error("Database connection failed:", err.message);
      throw err;
    }
  }
  return prisma;
};

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
