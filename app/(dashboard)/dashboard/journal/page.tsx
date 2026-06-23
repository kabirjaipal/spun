import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCustomers, mSuppliers, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export default async function JournalPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const journalVouchers = await db
    .select({
      voucherId: tVouchers.voucherId,
      voucherNo: tVouchers.voucherNo,
      voucherDate: tVouchers.voucherDate,
      partyId: tVouchers.partyId,
      remarks: tVouchers.remarks,
      totalAmount: tVouchers.totalAmount,
      partyCustomer: mCustomers.customerName,
      partySupplier: mSuppliers.supplierName,
    })
    .from(tVouchers)
    .leftJoin(mCustomers, eq(tVouchers.partyId, mCustomers.customerId))
    .leftJoin(mSuppliers, eq(tVouchers.partyId, mSuppliers.supplierId))
    .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "journal"), isNull(tVouchers.deletedOn)))
    .orderBy(tVouchers.voucherDate, "desc")
    .limit(12);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Journal Vouchers</h1>
        <p className="text-sm text-muted-foreground">
          Track adjustment and accrual entries with journal vouchers.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Voucher No</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Party</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {journalVouchers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No journal vouchers have been recorded yet.
                </td>
              </tr>
            ) : (
              journalVouchers.map((voucher) => {
                const partyName = voucher.partyCustomer || voucher.partySupplier || `ID ${voucher.partyId}`;
                return (
                  <tr key={voucher.voucherId} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{voucher.voucherNo}</td>
                    <td className="px-4 py-3 text-muted-foreground">{voucher.voucherDate?.toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-3 text-foreground">{partyName}</td>
                    <td className="px-4 py-3 text-right text-foreground">₹{Number(voucher.totalAmount ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate">{voucher.remarks || "—"}</td>
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
