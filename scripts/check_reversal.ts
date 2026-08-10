import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { tVouchers } from "../lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import * as schema from "../lib/db/schema";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

async function main() {
  const ids = [42, 39, 84, 61, 54, 53];
  const rows = await db
    .select()
    .from(tVouchers)
    .where(inArray(tVouchers.voucherId, ids));
  
  for (const r of rows) {
    console.log(`Voucher ID: ${r.voucherId}, No: ${r.voucherNo}, Type: ${r.voucherType}, Remarks: ${r.remarks}, NetAmount: ${r.netAmount}`);
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end();
});
