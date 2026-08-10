import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { tVouchers, tVoucherEntries, mLedgers } from "../lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import * as schema from "../lib/db/schema";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

async function main() {
  console.log("Fetching recent vouchers of type payment / receipt...");
  const vouchers = await db
    .select()
    .from(tVouchers)
    .where(inArray(tVouchers.voucherType, ["payment", "receipt"]))
    .orderBy(desc(tVouchers.voucherId))
    .limit(10);

  console.log(`Found ${vouchers.length} vouchers.`);
  for (const v of vouchers) {
    console.log(`\nVoucher ID: ${v.voucherId}, No: ${v.voucherNo}, Type: ${v.voucherType}, Date: ${v.voucherDate}, Amount: ${v.totalAmount}, CashBankLedgerId: ${v.cashBankLedgerId}`);
    const entries = await db
      .select()
      .from(tVoucherEntries)
      .where(eq(tVoucherEntries.voucherId, v.voucherId));
    
    for (const e of entries) {
      const ledger = await db
        .select()
        .from(mLedgers)
        .where(eq(mLedgers.ledgerId, e.ledgerId))
        .limit(1)
        .then(res => res[0]);
      
      console.log(`  - Entry ID: ${e.voucherEntryId}, Ledger: ${ledger?.ledgerName} (${ledger?.ledgerType}), Type: ${e.entryType}, Amount: ${e.amount}`);
    }
  }

  console.log("\nFetching Cash and Bank ledgers...");
  const ledgers = await db
    .select()
    .from(mLedgers)
    .where(inArray(mLedgers.ledgerType, ["cash", "bank", "general"]))
    .limit(30);
  
  for (const l of ledgers) {
    console.log(`Ledger ID: ${l.ledgerId}, Name: ${l.ledgerName}, Type: ${l.ledgerType}`);
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end();
});
