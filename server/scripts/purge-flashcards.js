/**
 * Purge the dedicated flashcard feature's data.
 *
 * The flashcard_deck resource type, per-page PdfFlashcard rows, and all
 * itemType:"flashcard" FSRS review items are removed for ALL users.
 * Card-style practice now runs inside the MCQ runner (flip/typing styles),
 * so the dedicated deck pipeline is dead weight.
 *
 * What it deletes (in order):
 *   1. PdfReviewItem where itemType = "flashcard"  (all FSRS history)
 *   2. PdfFlashcard rows                           (page-generated cards)
 *   3. Resource where contentType = "flashcard_deck" (generated decks —
 *      cascades bookmarks, ratings, comments, views, quiz attempts, etc.)
 *
 * What it does NOT touch:
 *   - customFlashcards in user data (the Resources → Flashcards custom bank)
 *   - MCQ items, decks' source PDFs/materials, folders
 *
 * Run report-only first:
 *   node scripts/purge-flashcards.js
 * Then apply:
 *   node scripts/purge-flashcards.js --apply
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
  const apply = process.argv.includes("--apply");

  console.log("Flashcard purge — counting what would be deleted...\n");

  const fsrsCount = await prisma.pdfReviewItem.count({ where: { itemType: "flashcard" } });
  const cardCount = await prisma.pdfFlashcard.count();
  const deckCount = await prisma.resource.count({ where: { contentType: "flashcard_deck" } });

  console.log(`  PdfReviewItem (itemType=flashcard): ${fsrsCount}`);
  console.log(`  PdfFlashcard rows:                  ${cardCount}`);
  console.log(`  Resource (flashcard_deck):        ${deckCount}`);

  if (!apply) {
    console.log("\nDry run — nothing deleted. Re-run with --apply to purge:");
    console.log("  node scripts/purge-flashcards.js --apply");
    return;
  }

  console.log("\n--apply detected. Deleting...");

  const r1 = await prisma.pdfReviewItem.deleteMany({ where: { itemType: "flashcard" } });
  console.log(`✓ Deleted ${r1.count} flashcard FSRS review items`);

  const r2 = await prisma.pdfFlashcard.deleteMany({});
  console.log(`✓ Deleted ${r2.count} page-generated flashcards`);

  const r3 = await prisma.resource.deleteMany({ where: { contentType: "flashcard_deck" } });
  console.log(`✓ Deleted ${r3.count} flashcard deck resources (children cascaded)`);

  console.log("\nDone. The dedicated flashcard feature is fully removed.");
}

main()
  .catch((err) => {
    console.error("Script failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
