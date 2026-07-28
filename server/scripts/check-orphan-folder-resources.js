/**
 * Read-only script: checks for resources with folderId pointing to
 * non-existent folders (orphaned references). Run with:
 *   node scripts/check-orphan-folder-resources.js
 *
 * Output: prints a report of orphaned resources. Does NOT modify data.
 * To clean up, append --fix flag:
 *   node scripts/check-orphan-folder-resources.js --fix
 */
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
        ? `${process.env.DATABASE_URL}${process.env.DATABASE_URL.includes("connection_limit") ? "" : "?connection_limit=3&pool_timeout=20"}`
        : undefined,
    },
  },
});

async function main() {
  const fix = process.argv.includes("--fix");

  console.log("Checking for resources with folderId...\n");

  const withFolder = await prisma.resource.findMany({
    where: { folderId: { not: null } },
    select: { id: true, title: true, folderId: true, uploadedBy: true, createdAt: true },
  });

  console.log(`Total resources with folderId: ${withFolder.length}`);

  if (withFolder.length === 0) {
    console.log("No resources have folderId set. Nothing to check.");
    return;
  }

  const folderIds = [...new Set(withFolder.map((r) => r.folderId))];
  console.log(`Distinct folderIds referenced: ${folderIds.length}\n`);

  const existingFolders = await prisma.folder.findMany({
    where: { id: { in: folderIds } },
    select: { id: true },
  });
  const existingFolderIds = new Set(existingFolders.map((f) => f.id));

  const orphaned = withFolder.filter((r) => !existingFolderIds.has(r.folderId));

  if (orphaned.length === 0) {
    console.log("✓ All folderId references are valid. No orphaned resources found.");
    return;
  }

  console.log(`⚠️  Found ${orphaned.length} orphaned resource(s) pointing to non-existent folders:\n`);
  for (const r of orphaned) {
    console.log(`  - [${r.id}] "${r.title}" → folderId: ${r.folderId} (uploaded by: ${r.uploadedBy}, created: ${r.createdAt?.toISOString?.()})`);
  }

  if (fix) {
    console.log("\n--fix flag detected. Nulling out orphaned folderId references...");
    const result = await prisma.resource.updateMany({
      where: { id: { in: orphaned.map((r) => r.id) } },
      data: { folderId: null },
    });
    console.log(`✓ Updated ${result.count} resource(s). They will now appear as loose materials.`);
  } else {
    console.log("\nTo clean up (set folderId=null on these resources), re-run with --fix:");
    console.log("  node scripts/check-orphan-folder-resources.js --fix");
  }
}

main()
  .catch((err) => {
    console.error("Script failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
