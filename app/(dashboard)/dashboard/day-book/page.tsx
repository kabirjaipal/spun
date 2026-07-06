import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  mCompanies,
  tVouchers,
  tVoucherEntries,
  tVoucherItems,
  mLedgers,
  mInventory,
} from "@/lib/db/schema";
import { and, eq, isNull, gte, lte, inArray, desc, sql } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import DayBookClient from "./DayBookClient";

export default async function DayBookPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);
  const params = await searchParams;

  // 1. Fetch Company Info
  const company = await db
    .select()
    .from(mCompanies)
    .where(eq(mCompanies.companyId, companyId))
    .limit(1)
    .then((res) => res[0]);

  if (!company) {
    redirect("/setup-company");
  }

  // Query today's date from the PostgreSQL database using SQL (UTC aligned)
  const [dbDateResult] = await db
    .select({
      today: sql<string>`CURRENT_DATE`,
    })
    .from(mCompanies)
    .limit(1);
  const todayStr = dbDateResult.today;
  const selectedDate = params.date || todayStr;

  // 2. Fetch Vouchers for the specific selected date
  const dbVouchers = await db
    .select({
      voucherId: tVouchers.voucherId,
      voucherNo: tVouchers.voucherNo,
      voucherType: tVouchers.voucherType,
      voucherDate: tVouchers.voucherDate,
      totalAmount: tVouchers.totalAmount,
      taxAmount: tVouchers.taxAmount,
      netAmount: tVouchers.netAmount,
      partyName: mLedgers.ledgerName,
    })
    .from(tVouchers)
    .leftJoin(mLedgers, eq(tVouchers.partyId, mLedgers.ledgerId))
    .where(
      and(
        eq(tVouchers.companyId, companyId),
        isNull(tVouchers.deletedOn),
        eq(tVouchers.voucherDate, selectedDate)
      )
    )
    .orderBy(tVouchers.voucherDate, tVouchers.voucherNo);

  const voucherIds = dbVouchers.map((v) => v.voucherId);

  let dbEntries: any[] = [];
  let dbItems: any[] = [];

  if (voucherIds.length > 0) {
    // 3. Fetch all accounting ledger postings for these vouchers
    dbEntries = await db
      .select({
        voucherId: tVoucherEntries.voucherId,
        entryId: tVoucherEntries.voucherEntryId,
        entryType: tVoucherEntries.entryType,
        amount: tVoucherEntries.amount,
        ledgerName: mLedgers.ledgerName,
      })
      .from(tVoucherEntries)
      .leftJoin(mLedgers, eq(tVoucherEntries.ledgerId, mLedgers.ledgerId))
      .where(inArray(tVoucherEntries.voucherId, voucherIds));

    // 4. Fetch all inventory item movements for these vouchers
    dbItems = await db
      .select({
        voucherId: tVoucherItems.voucherId,
        itemId: tVoucherItems.voucherItemId,
        quantity: tVoucherItems.quantity,
        rate: tVoucherItems.rate,
        netAmount: tVoucherItems.netAmount,
        itemName: mInventory.inventoryName,
      })
      .from(tVoucherItems)
      .leftJoin(mInventory, eq(tVoucherItems.inventoryId, mInventory.inventoryId))
      .where(inArray(tVoucherItems.voucherId, voucherIds));
  }

  // 5. Group entries & items inside vouchers in JavaScript
  const vouchersMap = new Map<number, any>();
  dbVouchers.forEach((v) => {
    vouchersMap.set(v.voucherId, {
      voucherId: v.voucherId,
      voucherNo: v.voucherNo,
      voucherType: v.voucherType,
      voucherDate: v.voucherDate,
      totalAmount: Number(v.totalAmount),
      taxAmount: Number(v.taxAmount),
      netAmount: Number(v.netAmount),
      partyName: v.partyName,
      entries: [],
      items: [],
    });
  });

  dbEntries.forEach((e) => {
    const v = vouchersMap.get(e.voucherId);
    if (v) {
      v.entries.push({
        entryId: e.entryId,
        entryType: e.entryType,
        amount: Number(e.amount),
        ledgerName: e.ledgerName,
      });
    }
  });

  dbItems.forEach((i) => {
    const v = vouchersMap.get(i.voucherId);
    if (v) {
      v.items.push({
        itemId: i.itemId,
        quantity: Number(i.quantity),
        rate: Number(i.rate),
        netAmount: Number(i.netAmount),
        itemName: i.itemName,
      });
    }
  });

  const vouchersList = Array.from(vouchersMap.values());

  // 6. Check access permissions
  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "day_book");
  const canExport = p?.e ?? false;

  return (
    <DayBookClient
      company={{
        companyId: company.companyId,
        companyName: company.companyName,
      }}
      vouchers={vouchersList}
      canExport={canExport}
      initialDate={selectedDate}
    />
  );
}
