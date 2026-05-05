import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

const connectWithTimeout = () =>
  new Promise((_resolve, reject) =>
    setTimeout(() => reject(new Error("Database connection timed out after 5s")), 5000)
  );

Promise.race([prisma.$connect(), connectWithTimeout()]).then(() => {
  console.log("Database connection established");
}).catch((err) => {
  console.error("Database connection failed:", err.message);
  process.exit(1);
});
