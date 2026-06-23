import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCustomers, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export default async function ReceiptPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const receipts = await db
    .select({
      voucherId: tVouchers.voucherId,
      voucherNo: tVouchers.voucherNo,
      voucherDate: tVouchers.voucherDate,
      partyId: tVouchers.partyId,
      totalAmount: tVouchers.totalAmount,
      remarks: tVouchers.remarks,
      customerName: mCustomers.customerName,
    })
    .from(tVouchers)
    .leftJoin(mCustomers, eq(tVouchers.partyId, mCustomers.customerId))
    .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "receipt"), isNull(tVouchers.deletedOn)))
    .orderBy(tVouchers.voucherDate, "desc")
    .limit(12);

  const totalAmount = receipts.reduce((sum, item) => sum + Number(item.totalAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Receipt Vouchers</h1>
        <p className="text-sm text-muted-foreground">
          Review receipts from customers and advances collected into your account.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Receipts recorded</p>
          <p className="mt-3 text-3xl font-bold text-foreground">{receipts.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total amount</p>
          <p className="mt-3 text-3xl font-bold text-foreground">₹{totalAmount.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Latest receipt</p>
          <p className="mt-3 text-lg font-semibold text-foreground">
            {receipts[0]?.voucherNo ?? "None"}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Voucher No</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No receipt vouchers found.
                </td>
              </tr>
            ) : (
              receipts.map((receipt) => (
                <tr key={receipt.voucherId} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{receipt.voucherNo}</td>
                  <td className="px-4 py-3 text-muted-foreground">{receipt.voucherDate?.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3 text-foreground">{receipt.customerName || `ID ${receipt.partyId}`}</td>
                  <td className="px-4 py-3 text-right text-foreground">₹{Number(receipt.totalAmount ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate">{receipt.remarks || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
