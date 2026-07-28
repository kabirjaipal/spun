import React from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  mInventory,
  mCompanies,
  mLedgers,
  mLedgerGroups,
  tVouchers,
  tVoucherEntries,
  tStockMovements,
} from "@/lib/db/schema";
import { eq, sql, isNull, and, gte, lte, or, inArray, notInArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");

  if (session.user.role === "owner" && !session.user.companyId) {
    redirect("/dashboard/owner");
  }

  if (!session.user.companyId) redirect("/setup-company");

  const companyIdVal = Number(session.user.companyId);
  const params = await searchParams;

  // Fetch Company Info
  const company = await db.query.mCompanies.findFirst({
    where: eq(mCompanies.companyId, companyIdVal),
  });

  if (!company) {
    redirect("/setup-company");
  }

  // Dynamic current FY (April start)
  const today = new Date();
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fromDate = params.from || `${fyStartYear}-04-01`;
  const toDate = params.to || `${fyStartYear + 1}-03-31`;

  // 1. Fetch ledgers data (Cumulative balances up to toDate and Period balances)
  const ledgersData = await db
    .select({
      ledgerId: mLedgers.ledgerId,
      ledgerName: mLedgers.ledgerName,
      ledgerType: mLedgers.ledgerType,
      groupId: mLedgers.groupId,
      groupName: mLedgerGroups.groupName,
      creditDays: mLedgers.creditDays,
      debitCumulative: sql<number>`coalesce(sum(case when ${tVouchers.voucherDate} <= ${toDate} and ${tVoucherEntries.entryType} = 'debit' then ${tVoucherEntries.amount} else 0 end), 0)`,
      creditCumulative: sql<number>`coalesce(sum(case when ${tVouchers.voucherDate} <= ${toDate} and ${tVoucherEntries.entryType} = 'credit' then ${tVoucherEntries.amount} else 0 end), 0)`,
      debitPeriod: sql<number>`coalesce(sum(case when ${tVouchers.voucherDate} >= ${fromDate} and ${tVouchers.voucherDate} <= ${toDate} and ${tVoucherEntries.entryType} = 'debit' then ${tVoucherEntries.amount} else 0 end), 0)`,
      creditPeriod: sql<number>`coalesce(sum(case when ${tVouchers.voucherDate} >= ${fromDate} and ${tVouchers.voucherDate} <= ${toDate} and ${tVoucherEntries.entryType} = 'credit' then ${tVoucherEntries.amount} else 0 end), 0)`,
    })
    .from(mLedgers)
    .leftJoin(mLedgerGroups, eq(mLedgers.groupId, mLedgerGroups.groupId))
    .leftJoin(tVoucherEntries, eq(mLedgers.ledgerId, tVoucherEntries.ledgerId))
    .leftJoin(
      tVouchers,
      and(
        eq(tVoucherEntries.voucherId, tVouchers.voucherId),
        isNull(tVouchers.deletedOn)
      )
    )
    .where(and(eq(mLedgers.companyId, companyIdVal), isNull(mLedgers.deletedOn)))
    .groupBy(
      mLedgers.ledgerId,
      mLedgers.ledgerName,
      mLedgers.ledgerType,
      mLedgers.groupId,
      mLedgerGroups.groupName,
      mLedgers.creditDays
    );

  // 2. Fetch monthly sales and purchases stats for line charts
  const monthlyStats = await db
    .select({
      month: sql<string>`to_char(${tVouchers.voucherDate}, 'Mon-YY')`,
      sortKey: sql<string>`to_char(${tVouchers.voucherDate}, 'YYYY-MM')`,
      sales: sql<number>`coalesce(sum(case when ${tVouchers.voucherType} = 'sale' then ${tVouchers.netAmount} else 0 end), 0)`,
      purchases: sql<number>`coalesce(sum(case when ${tVouchers.voucherType} = 'purchase' then ${tVouchers.netAmount} else 0 end), 0)`,
    })
    .from(tVouchers)
    .where(
      and(
        eq(tVouchers.companyId, companyIdVal),
        isNull(tVouchers.deletedOn),
        gte(tVouchers.voucherDate, fromDate),
        lte(tVouchers.voucherDate, toDate)
      )
    )
    .groupBy(sql`to_char(${tVouchers.voucherDate}, 'Mon-YY')`, sql`to_char(${tVouchers.voucherDate}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${tVouchers.voucherDate}, 'YYYY-MM')`);

  // 3. Fetch vouchers and adjustments up to toDate for outstanding calculating
  const allVouchers = await db
    .select({
      voucherId: tVouchers.voucherId,
      voucherNo: tVouchers.voucherNo,
      voucherType: tVouchers.voucherType,
      voucherDate: tVouchers.voucherDate,
      netAmount: tVouchers.netAmount,
      partyId: tVouchers.partyId,
      billDetails: tVouchers.billDetails,
      remarks: tVouchers.remarks,
    })
    .from(tVouchers)
    .where(
      and(
        eq(tVouchers.companyId, companyIdVal),
        isNull(tVouchers.deletedOn),
        notInArray(tVouchers.voucherType, ["purchase_order", "sales_order"]),
        lte(tVouchers.voucherDate, toDate)
      )
    );

  // 4. Fetch Inventory Opening Stock (before fromDate) and Closing Stock (up to toDate)
  const openingStockData = await db
    .select({
      inventoryId: mInventory.inventoryId,
      openingQty: mInventory.openingStockQty,
      openingRate: mInventory.openingStockRate,
      qtyIn: sql<number>`coalesce(sum(case when ${tStockMovements.movementType} in ('purchase','opening') and ${tVouchers.voucherDate} < ${fromDate} then ${tStockMovements.quantity} else 0 end), 0)`,
      qtyOut: sql<number>`coalesce(sum(case when ${tStockMovements.movementType} = 'sale' and ${tVouchers.voucherDate} < ${fromDate} then ${tStockMovements.quantity} else 0 end), 0)`,
      avgRateIn: sql<number>`coalesce(avg(case when ${tStockMovements.movementType} in ('purchase','opening') then ${tStockMovements.rate} else null end), 0)`,
    })
    .from(mInventory)
    .leftJoin(
      tStockMovements,
      and(eq(mInventory.inventoryId, tStockMovements.inventoryId), isNull(tStockMovements.deletedOn))
    )
    .leftJoin(tVouchers, and(eq(tStockMovements.voucherId, tVouchers.voucherId), isNull(tVouchers.deletedOn)))
    .where(and(eq(mInventory.companyId, companyIdVal), isNull(mInventory.deletedOn)))
    .groupBy(mInventory.inventoryId, mInventory.openingStockQty, mInventory.openingStockRate);

  let openingStock = 0;
  for (const item of openingStockData) {
    const qty = Number(item.openingQty) + Number(item.qtyIn) - Number(item.qtyOut);
    const rate = Number(item.avgRateIn) > 0 ? Number(item.avgRateIn) : Number(item.openingRate);
    openingStock += Math.max(0, qty) * rate;
  }

  const closingStockData = await db
    .select({
      inventoryId: mInventory.inventoryId,
      openingQty: mInventory.openingStockQty,
      openingRate: mInventory.openingStockRate,
      qtyIn: sql<number>`coalesce(sum(case when ${tStockMovements.movementType} in ('purchase','opening') then ${tStockMovements.quantity} else 0 end), 0)`,
      qtyOut: sql<number>`coalesce(sum(case when ${tStockMovements.movementType} = 'sale' then ${tStockMovements.quantity} else 0 end), 0)`,
      avgRateIn: sql<number>`coalesce(avg(case when ${tStockMovements.movementType} in ('purchase','opening') then ${tStockMovements.rate} else null end), 0)`,
    })
    .from(mInventory)
    .leftJoin(
      tStockMovements,
      and(eq(mInventory.inventoryId, tStockMovements.inventoryId), isNull(tStockMovements.deletedOn))
    )
    .leftJoin(tVouchers, and(eq(tStockMovements.voucherId, tVouchers.voucherId), isNull(tVouchers.deletedOn)))
    .where(
      and(
        eq(mInventory.companyId, companyIdVal),
        isNull(mInventory.deletedOn),
        or(
          isNull(tStockMovements.voucherId),
          and(isNull(tVouchers.deletedOn), lte(tVouchers.voucherDate, toDate))
        )
      )
    )
    .groupBy(mInventory.inventoryId, mInventory.openingStockQty, mInventory.openingStockRate);

  let closingStock = 0;
  let closingStockQty = 0;
  for (const item of closingStockData) {
    const qty = Number(item.openingQty) + Number(item.qtyIn) - Number(item.qtyOut);
    const rate = Number(item.avgRateIn) > 0 ? Number(item.avgRateIn) : Number(item.openingRate);
    closingStock += Math.max(0, qty) * rate;
    closingStockQty += Math.max(0, qty);
  }

  // 5. Fetch Inventory Outwards during the period
  const inventoryOutwards = await db
    .select({
      quantity: sql<number>`coalesce(sum(${tStockMovements.quantity}), 0)`,
      value: sql<number>`coalesce(sum(${tStockMovements.amount}), 0)`,
    })
    .from(tStockMovements)
    .innerJoin(tVouchers, eq(tStockMovements.voucherId, tVouchers.voucherId))
    .where(
      and(
        eq(tStockMovements.companyId, companyIdVal),
        eq(tStockMovements.movementType, "sale"),
        isNull(tStockMovements.deletedOn),
        isNull(tVouchers.deletedOn),
        gte(tVouchers.voucherDate, fromDate),
        lte(tVouchers.voucherDate, toDate)
      )
    );
  const outwardsQty = Number(inventoryOutwards[0]?.quantity || 0);
  const outwardsValue = Number(inventoryOutwards[0]?.value || 0);

  // 6. Fetch sub-companies / parties
  const parties = await db
    .select({
      companyId: mCompanies.companyId,
      dueDay: mCompanies.dueDay,
    })
    .from(mCompanies)
    .where(and(eq(mCompanies.parentCompanyId, companyIdVal), isNull(mCompanies.deletedOn)));

  const mappedParties = parties.map((p) => ({
    companyId: p.companyId,
    dueDay: p.dueDay,
  }));

  const serializedLedgers = ledgersData.map((l) => ({
    ledgerId: l.ledgerId,
    ledgerName: l.ledgerName,
    ledgerType: l.ledgerType,
    groupId: l.groupId,
    groupName: l.groupName || "",
    creditDays: l.creditDays,
    debitCumulative: Number(l.debitCumulative),
    creditCumulative: Number(l.creditCumulative),
    debitPeriod: Number(l.debitPeriod),
    creditPeriod: Number(l.creditPeriod),
  }));

  const serializedVouchers = allVouchers.map((v) => ({
    voucherId: v.voucherId,
    voucherNo: v.voucherNo,
    voucherType: v.voucherType,
    voucherDate: v.voucherDate,
    netAmount: Number(v.netAmount),
    partyId: v.partyId ? Number(v.partyId) : null,
    billDetails: v.billDetails,
  }));

  const serializedMonthly = monthlyStats.map((s) => ({
    month: s.month || "",
    sortKey: s.sortKey || "",
    sales: Number(s.sales),
    purchases: Number(s.purchases),
  }));

  return (
    <DashboardClient
      company={{
        companyId: company.companyId,
        companyName: company.companyName,
        gstNo: company.gstNo || "",
        address: company.address || "",
      }}
      fromDate={fromDate}
      toDate={toDate}
      ledgers={serializedLedgers}
      monthlyStats={serializedMonthly}
      vouchers={serializedVouchers}
      parties={mappedParties}
      openingStock={openingStock}
      closingStock={closingStock}
      closingStockQty={closingStockQty}
      outwardsQty={outwardsQty}
      outwardsValue={outwardsValue}
    />
  );
}

