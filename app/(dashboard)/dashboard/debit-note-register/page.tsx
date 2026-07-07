import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  mCompanies,
  tVouchers,
} from "@/lib/db/schema";
import { and, eq, isNull, gte, lte } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import DebitNoteRegisterClient from "./DebitNoteRegisterClient";

export default async function DebitNoteRegisterPage({
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

  // 2. Fetch Debit Notes Vouchers with Party names
  const rawVouchers = await db
    .select({
      voucherId: tVouchers.voucherId,
      voucherNo: tVouchers.voucherNo,
      voucherDate: tVouchers.voucherDate,
      netAmount: tVouchers.netAmount,
      status: tVouchers.status,
      partyName: mCompanies.companyName,
    })
    .from(tVouchers)
    .leftJoin(mCompanies, eq(tVouchers.partyId, mCompanies.companyId))
    .where(
      and(
        eq(tVouchers.companyId, companyId),
        eq(tVouchers.voucherType, "debit_note"),
        isNull(tVouchers.deletedOn),
        gte(tVouchers.voucherDate, fromDate),
        lte(tVouchers.voucherDate, toDate)
      )
    )
    .orderBy(tVouchers.voucherDate);

  // 3. Generate list of months chronologically in the date range
  const start = new Date(fromDate + "T00:00:00");
  const end = new Date(toDate + "T00:00:00");

  const monthsList: { key: string; label: string; year: number }[] = [];
  let curr = new Date(start.getFullYear(), start.getMonth(), 1);
  const endLimit = new Date(end.getFullYear(), end.getMonth(), 1);

  while (curr <= endLimit) {
    const label = curr.toLocaleDateString("en-US", { month: "long" });
    const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, "0")}`;
    monthsList.push({
      key,
      label,
      year: curr.getFullYear(),
    });
    curr.setMonth(curr.getMonth() + 1);
  }

  // 4. Map vouchers into months
  const monthlySummary = monthsList.map((month) => {
    // Filter vouchers belonging to this month (using YYYY-MM key match)
    const monthVouchers = rawVouchers.filter(
      (v) => v.voucherDate.slice(0, 7) === month.key
    );

    const totalVouchers = monthVouchers.length;
    const cancelledVouchers = monthVouchers.filter((v) => v.status === "cancelled").length;
    const netAmount = monthVouchers
      .filter((v) => v.status !== "cancelled")
      .reduce((sum, v) => sum + Number(v.netAmount), 0);

    return {
      monthKey: month.key,
      monthName: month.label,
      year: month.year,
      totalVouchers,
      cancelledVouchers,
      netAmount,
      vouchers: monthVouchers.map((v) => ({
        voucherId: v.voucherId,
        voucherNo: v.voucherNo,
        voucherDate: v.voucherDate,
        netAmount: Number(v.netAmount),
        status: v.status,
        partyName: v.partyName || "Cash/General Party",
      })),
    };
  });

  // 5. Check permissions
  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "debit_note_register");
  const canExport = p?.e ?? false;

  return (
    <DebitNoteRegisterClient
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
