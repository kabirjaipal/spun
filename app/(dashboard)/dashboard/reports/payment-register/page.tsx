import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  mCompanies,
  tVouchers,
  tVoucherEntries,
  mLedgers,
} from "@/lib/db/schema";
import { and, eq, isNull, gte, lte, inArray } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import PaymentRegisterClient from "./PaymentRegisterClient";

export default async function PaymentRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
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

  // Dynamic current FY (April start)
  const today = new Date();
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fromDate = params.from || `${fyStartYear}-04-01`;
  const toDate = params.to || `${fyStartYear + 1}-03-31`;

  // 2. Fetch Payment Vouchers
  const paymentVouchers = await db
    .select({
      voucherId: tVouchers.voucherId,
      voucherNo: tVouchers.voucherNo,
      voucherDate: tVouchers.voucherDate,
      voucherType: tVouchers.voucherType,
      netAmount: tVouchers.netAmount,
      remarks: tVouchers.remarks,
      status: tVouchers.status,
    })
    .from(tVouchers)
    .where(
      and(
        eq(tVouchers.companyId, companyId),
        eq(tVouchers.voucherType, "payment"),
        isNull(tVouchers.deletedOn),
        gte(tVouchers.voucherDate, fromDate),
        lte(tVouchers.voucherDate, toDate)
      )
    )
    .orderBy(tVouchers.voucherDate, tVouchers.voucherNo);

  const voucherIds = paymentVouchers.map((v) => v.voucherId);

  let dbEntries: any[] = [];
  if (voucherIds.length > 0) {
    // 3. Fetch all accounting ledger postings for these vouchers
    dbEntries = await db
      .select({
        voucherId: tVoucherEntries.voucherId,
        entryId: tVoucherEntries.voucherEntryId,
        entryType: tVoucherEntries.entryType,
        amount: tVoucherEntries.amount,
        ledgerId: tVoucherEntries.ledgerId,
        ledgerName: mLedgers.ledgerName,
      })
      .from(tVoucherEntries)
      .leftJoin(mLedgers, eq(tVoucherEntries.ledgerId, mLedgers.ledgerId))
      .where(inArray(tVoucherEntries.voucherId, voucherIds));
  }

  // 4. Group entries inside vouchers
  const vouchersMap = new Map<number, any>();
  paymentVouchers.forEach((v) => {
    vouchersMap.set(v.voucherId, {
      voucherId: v.voucherId,
      voucherNo: v.voucherNo,
      voucherType: v.voucherType,
      voucherDate: v.voucherDate,
      netAmount: Number(v.netAmount),
      remarks: v.remarks,
      status: v.status,
      entries: [],
    });
  });

  dbEntries.forEach((e) => {
    const v = vouchersMap.get(e.voucherId);
    if (v) {
      v.entries.push({
        entryId: e.entryId,
        entryType: e.entryType,
        amount: Number(e.amount),
        ledgerId: e.ledgerId,
        ledgerName: e.ledgerName || "Unknown Ledger",
      });
    }
  });

  const vouchersList = Array.from(vouchersMap.values());

  // 5. Generate list of months chronologically in the date range
  const start = new Date(fromDate + "T00:00:00");
  const end = new Date(toDate + "T00:00:00");

  const monthsList: { key: string; label: string; year: number }[] = [];
  let curr = new Date(start.getFullYear(), start.getMonth(), 1);
  const endLimit = new Date(end.getFullYear(), end.getMonth(), 1);

  while (curr <= endLimit) {
    monthsList.push({
      key: `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, "0")}`,
      label: curr.toLocaleDateString("en-US", { month: "long" }),
      year: curr.getFullYear(),
    });
    curr.setMonth(curr.getMonth() + 1);
  }

  // 6. Map vouchers into months
  const monthlySummary = monthsList.map((month) => {
    const monthVouchers = vouchersList.filter(
      (v) => v.voucherDate.slice(0, 7) === month.key
    );

    const totalVouchers = monthVouchers.length;
    const cancelledVouchers = monthVouchers.filter((v) => v.status === "cancelled").length;
    const netAmount = monthVouchers
      .filter((v) => v.status !== "cancelled")
      .reduce((sum, v) => sum + v.netAmount, 0);

    return {
      monthKey: month.key,
      monthName: month.label,
      year: month.year,
      totalVouchers,
      cancelledVouchers,
      netAmount,
      vouchers: monthVouchers,
    };
  });

  // 7. Check permissions
  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "payment_register");
  const canExport = p?.e ?? false;

  return (
    <PaymentRegisterClient
      company={{
        companyId: company.companyId,
        companyName: company.companyName,
        gstNo: company.gstNo,
        address: company.address,
      }}
      monthlySummary={monthlySummary}
      canExport={canExport}
    />
  );
}
