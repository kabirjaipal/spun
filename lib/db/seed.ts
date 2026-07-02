import { db } from "./index";
import { mUsers } from "./schema";
import bcrypt from "bcryptjs";
import { seedRealData } from "./real_seed";

export async function seedDatabase() {
  console.log("Seeding database with default owner user...");

  // 1. Hash password for default owner user
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash("password123", salt);

  // 2. Create default owner user (no company associated initially)
  await db.insert(mUsers).values({
    name: "Default Owner",
    email: "owner@spun.app",
    passwordHash,
    role: "owner",
    isActive: true,
  });

  console.log("Database seeded successfully! Default login: owner@spun.app / password123 (No Company)");

  // 3. Call the realistic company data seed
  await seedRealData();
  console.log("Database seeded with realistic company data! Test login: test@spun.app / password123 (Spun Trading Co.)");
}
