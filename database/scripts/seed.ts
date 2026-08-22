import { createKysely, closeKysely } from "@saas/database";

async function seed(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  const db = createKysely({ connectionString });

  try {
    // Placeholder for seed data
    console.log("Seeding not implemented in foundation phase");
  } finally {
    await closeKysely(db);
  }
}

void seed();
