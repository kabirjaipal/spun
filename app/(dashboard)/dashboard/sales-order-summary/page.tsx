import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCompanies, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull, gte, lte } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import SalesOrderSummaryClient from "./SalesOrderSummaryClient";

export default async function SalesOrderSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);
  const params = await searchParams;

  const company = await db
    .select()
    .from(mCompanies)
    .where(eq(mCompanies.companyId, companyId))
    .limit(1)
    .then((res) => res[0]);

  if (!company) {
    redirect("/setup-company");
  }

  const today = new Date();
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fromDate = params.from || `${fyStartYear}-04-01`;
  const toDate = params.to || `${fyStartYear + 1}-03-31`;

  // Fetch sales orders (voucherType: 'sales_order')
  const orders = await db
    .select({
      voucherId: tVouchers.voucherId,
      voucherNo: tVouchers.voucherNo,
      voucherDate: tVouchers.voucherDate,
      netAmount: tVouchers.netAmount,
      status: tVouchers.status,
      partyName: mCompanies.companyName,
      dueDate: tVouchers.lrDate,
    })
    .from(tVouchers)
    .leftJoin(mCompanies, eq(tVouchers.partyId, mCompanies.companyId))
    .where(
      and(
        eq(tVouchers.companyId, companyId),
        eq(tVouchers.voucherType, "sales_order"),
        isNull(tVouchers.deletedOn),
        gte(tVouchers.voucherDate, fromDate),
        lte(tVouchers.voucherDate, toDate)
      )
    )
    .orderBy(tVouchers.voucherDate, tVouchers.voucherNo);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const canExport = perms.find((x) => x.accessItem === "sales_order_summary")?.e ?? false;

  return (
    <SalesOrderSummaryClient
      company={{
        companyId: company.companyId,
        companyName: company.companyName,
        gstNo: company.gstNo,
        address: company.address,
      }}
      orders={orders.map(o => ({
        ...o,
        netAmount: Number(o.netAmount),
        partyName: o.partyName || "General Customer",
      }))}
      canExport={canExport}
    />
  );
}
