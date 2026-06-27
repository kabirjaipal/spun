#!/usr/bin/env -S npx tsx --env-file=.env
import { db } from "../lib/db";
import { sql } from "drizzle-orm";
import { execSync } from "child_process";
import path from "path";
import { Client } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const url = new URL(connectionString);
  const dbName = url.pathname.slice(1);

  // Connect to the default 'postgres' database to check/create the target database
  url.pathname = "/postgres";
  const client = new Client({ connectionString: url.toString() });

  try {
    await client.connect();
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (res.rowCount === 0) {
      console.log(`Database "${dbName}" does not exist. Creating...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created successfully.`);
    }
  } catch (error) {
    console.warn("Could not check or create database (might already exist or permission denied):", error);
  } finally {
    await client.end();
  }

  console.log("Resetting database schema...");
  try {
    // Drop and recreate schema public to wipe all tables, types, etc.
    // Also drop drizzle metadata schema so drizzle-kit re-runs all migrations
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE;`);
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE;`);
    await db.execute(sql`CREATE SCHEMA public;`);
    await db.execute(sql`GRANT ALL ON SCHEMA public TO public;`);
    
    console.log("Database schema reset successfully.");
  } catch (error) {
    console.error("Failed to reset database schema:", error);
    process.exit(1);
  }

  // Prepend current node execution binary directory to PATH to ensure npx and node work correctly
  const nodeBinDir = path.dirname(process.execPath);
  const env = {
    ...process.env,
    PATH: `${nodeBinDir}${path.delimiter}${process.env.PATH || ""}`,
  };

  console.log("Running migrations...");
  try {
    execSync("npx drizzle-kit migrate", { stdio: "inherit", env });
  } catch (error) {
    console.error("Failed to run migrations.");
    process.exit(1);
  }

  console.log("Seeding database...");
  try {
    // Dynamic import to seed using the project's seeding logic
    const { seedDatabase } = await import("../lib/db/seed");
    await seedDatabase();
    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Failed to seed database:", error);
    process.exit(1);
  }
}

main().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});

