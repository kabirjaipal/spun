import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

declare global {
  // eslint-disable-next-line no-var
  var db: ReturnType<typeof drizzle<typeof schema>> | undefined;
  // eslint-disable-next-line no-var
  var pool: Pool | undefined;
}

let pool: Pool;
let db: ReturnType<typeof drizzle<typeof schema>>;

if (process.env.NODE_ENV === "production") {
  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    allowExitOnIdle: true,
  });
  db = drizzle(pool, { schema });
} else {
  if (!globalThis.pool) {
    globalThis.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });
  }
  pool = globalThis.pool;
  if (!globalThis.db) {
    globalThis.db = drizzle(pool, { schema });
  }
  db = globalThis.db;
}

export { db, pool };
export type DbType = typeof db;
export * from "./schema";
