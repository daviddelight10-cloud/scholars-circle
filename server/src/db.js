import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

// Probe the database connection at startup so misconfiguration surfaces
// immediately in logs rather than on the first incoming request.
const CONNECTION_TIMEOUT_MS = 5000;

const connectionProbe = new Promise((_resolve, reject) =>
  setTimeout(
    () => reject(new Error("Database connection timed out after 5 s")),
    CONNECTION_TIMEOUT_MS
  )
);

Promise.race([prisma.$connect(), connectionProbe])
  .then(() => {
    console.log("Database connection established");
  })
  .catch((err) => {
    console.error("Failed to connect to database:", err.message);
    // Exit so Railway restarts the container rather than serving requests
    // against a broken DB connection.
    process.exit(1);
  });
