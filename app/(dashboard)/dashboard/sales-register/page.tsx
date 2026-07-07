import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  mCompanies,
  tVouchers,
} from "@/lib/db/schema";
import { and, eq, isNull, gte, lte, inArray } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import SalesRegisterClient from "./SalesRegisterClient";

export default async function SalesRegisterPage({
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

  // 2. Fetch sales invoices and returns
  const vouchers = await db
    .select({
      voucherId: tVouchers.voucherId,
      voucherType: tVouchers.voucherType,
      voucherDate: tVouchers.voucherDate,
      netAmount: tVouchers.netAmount,
    })
    .from(tVouchers)
    .where(
      and(
        eq(tVouchers.companyId, companyId),
        inArray(tVouchers.voucherType, ["sale", "sales_return"]),
        isNull(tVouchers.deletedOn),
        gte(tVouchers.voucherDate, fromDate),
        lte(tVouchers.voucherDate, toDate)
      )
    )
    .orderBy(tVouchers.voucherDate);

  // 3. Generate list of months in the date range
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

  // 4. Map transactions into months and calculate cumulative running balance
  // Since sales are credit accounts, closing balance increases with credits and decreases with debits
  let runningBalance = 0;
  const monthlySummary = monthsList.map((month) => {
    // Filter vouchers belonging to this month
    const monthVouchers = vouchers.filter(
      (v) => v.voucherDate.slice(0, 7) === month.key
    );

    const credit = monthVouchers
      .filter((v) => v.voucherType === "sale")
      .reduce((sum, v) => sum + Number(v.netAmount), 0);

    const debit = monthVouchers
      .filter((v) => v.voucherType === "sales_return")
      .reduce((sum, v) => sum + Number(v.netAmount), 0);

    runningBalance += (credit - debit);

    return {
      monthKey: month.key,
      monthName: month.label,
      year: month.year,
      debit, // Sales Return
      credit, // Sales Invoice
      closingBalance: runningBalance,
    };
  });

  // 5. Check permissions
  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "sales_register");
  const canExport = p?.e ?? false;

  return (
    <SalesRegisterClient
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
