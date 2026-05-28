import { PrismaClient } from "@prisma/client";

console.log("[db] Initializing Prisma client...");

export const prisma = new PrismaClient({
  log: ["error", "warn"],
});

// Probe the database connection at startup so the process fails fast
// instead of hanging silently when DATABASE_URL is unreachable or the
// generated client is missing.
const CONNECTION_TIMEOUT_MS = 10_000;

const connectionProbe = prisma
  .$connect()
  .then(() => {
    console.log("[db] Database connection established.");
  })
  .catch((err) => {
    console.error("[db] Failed to connect to the database:", err.message);
    console.error(
      "[db] Check that DATABASE_URL is set correctly and the database is reachable."
    );
    process.exit(1);
  });

const connectionTimeout = new Promise((_resolve, reject) =>
  setTimeout(
    () => reject(new Error("Timed out waiting for database connection")),
    CONNECTION_TIMEOUT_MS
  )
);

Promise.race([connectionProbe, connectionTimeout]).catch((err) => {
  console.error("[db]", err.message);
  process.exit(1);
});
