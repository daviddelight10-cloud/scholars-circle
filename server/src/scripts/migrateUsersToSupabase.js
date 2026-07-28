import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function migrateUsersToSupabase() {
  console.log("Starting user migration to Supabase Auth...\n");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      fullName: true,
      role: true,
      isActivated: true,
      supabaseId: true,
    },
  });

  console.log(`Found ${users.length} users in Prisma.\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  const failures = [];

  for (const user of users) {
    // Skip users that already have a supabaseId
    if (user.supabaseId) {
      console.log(`[SKIP] User ${user.email} already has supabaseId: ${user.supabaseId}`);
      skipped++;
      continue;
    }

    try {
      // Use Supabase "invite user by email" API — sends a password setup email
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        user.email,
        {
          data: {
            fullName: user.fullName,
            role: user.role,
          },
        }
      );

      if (error) {
        // If user already exists in Supabase Auth, try to find them
        if (error.message?.includes("already been registered") || error.message?.includes("already exists")) {
          console.log(`[INFO] User ${user.email} already exists in Supabase Auth. Linking...`);
          // List users to find the existing one
          const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          if (listError) throw listError;

          const existingUser = listData.users.find((u) => u.email === user.email);
          if (existingUser) {
            await prisma.user.update({
              where: { id: user.id },
              data: { supabaseId: existingUser.id },
            });
            console.log(`[LINKED] User ${user.email} -> supabaseId: ${existingUser.id}`);
            migrated++;
            continue;
          }
        }
        throw error;
      }

      // Update Prisma user with the Supabase user ID
      if (data?.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { supabaseId: data.id },
        });

        // Update Supabase user's app_metadata with prismaId and role
        try {
          await supabaseAdmin.auth.admin.updateUserById(data.id, {
            app_metadata: { prismaId: user.id, role: user.role },
          });
        } catch (metaErr) {
          console.error(`[WARN] Failed to set app_metadata for ${user.email}:`, metaErr.message);
        }

        console.log(`[OK] User ${user.email} -> supabaseId: ${data.id}`);
        migrated++;
      }
    } catch (err) {
      console.error(`[FAIL] User ${user.email}: ${err.message}`);
      failures.push({ email: user.email, error: err.message });
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log("\n--- Migration Summary ---");
  console.log(`Total users: ${users.length}`);
  console.log(`Migrated:    ${migrated}`);
  console.log(`Skipped:     ${skipped}`);
  console.log(`Failed:      ${failed}`);

  if (failures.length > 0) {
    console.log("\n--- Failures ---");
    for (const f of failures) {
      console.log(`  ${f.email}: ${f.error}`);
    }
  }

  await prisma.$disconnect();
}

migrateUsersToSupabase().catch((err) => {
  console.error("Migration script failed:", err);
  process.exit(1);
});
