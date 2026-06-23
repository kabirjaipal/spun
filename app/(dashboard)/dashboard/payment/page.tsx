import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCustomers, mSuppliers, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

export default async function PaymentPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const payments = await db
    .select({
      voucherId: tVouchers.voucherId,
      voucherNo: tVouchers.voucherNo,
      voucherDate: tVouchers.voucherDate,
      partyId: tVouchers.partyId,
      totalAmount: tVouchers.totalAmount,
      remarks: tVouchers.remarks,
      customerName: mCustomers.customerName,
      supplierName: mSuppliers.supplierName,
    })
    .from(tVouchers)
    .leftJoin(mCustomers, eq(tVouchers.partyId, mCustomers.customerId))
    .leftJoin(mSuppliers, eq(tVouchers.partyId, mSuppliers.supplierId))
    .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "payment"), isNull(tVouchers.deletedOn)))
    .orderBy(tVouchers.voucherDate, "desc")
    .limit(12);

  const totalPayments = payments.reduce((sum, item) => sum + Number(item.totalAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Payment Vouchers</h1>
        <p className="text-sm text-muted-foreground">
          Review cash and supplier payment entries recorded in your company.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Recent Payments</p>
          <p className="mt-3 text-3xl font-bold text-foreground">{payments.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Amount</p>
          <p className="mt-3 text-3xl font-bold text-foreground">₹{totalPayments.toFixed(2)}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Voucher No</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Party</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No payment vouchers recorded yet.
                </td>
              </tr>
            ) : (
              payments.map((payment) => {
                const partyName = payment.customerName || payment.supplierName || `ID ${payment.partyId}`;
                return (
                  <tr key={payment.voucherId} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{payment.voucherNo}</td>
                    <td className="px-4 py-3 text-muted-foreground">{payment.voucherDate?.toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-3 text-foreground">{partyName}</td>
                    <td className="px-4 py-3 text-right text-foreground">₹{Number(payment.totalAmount ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate">{payment.remarks || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
