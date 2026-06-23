import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/texora",
});

export const db = drizzle(pool, { schema });
export type DbType = typeof db;
export * from "./schema";
