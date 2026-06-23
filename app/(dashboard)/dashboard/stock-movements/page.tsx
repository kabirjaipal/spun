import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mProducts, tStockMovements, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export default async function StockMovementsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const movements = await db
    .select({
      stockMovementId: tStockMovements.stockMovementId,
      productName: mProducts.productName,
      movementType: tStockMovements.movementType,
      quantity: tStockMovements.quantity,
      rate: tStockMovements.rate,
      amount: tStockMovements.amount,
      voucherNo: tVouchers.voucherNo,
      voucherDate: tVouchers.voucherDate,
    })
    .from(tStockMovements)
    .leftJoin(mProducts, eq(tStockMovements.productId, mProducts.productId))
    .leftJoin(tVouchers, eq(tStockMovements.voucherId, tVouchers.voucherId))
    .where(and(eq(tStockMovements.companyId, companyId), isNull(mProducts.deletedOn)))
    .orderBy(tStockMovements.createdOn, "desc")
    .limit(20);

  const totalIn = movements.reduce(
    (sum, item) => sum + (item.movementType === "purchase" || item.movementType === "opening" ? Number(item.quantity ?? 0) : 0),
    0
  );
  const totalOut = movements.reduce(
    (sum, item) => sum + (item.movementType === "sale" ? Number(item.quantity ?? 0) : 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Stock Movements</h1>
        <p className="text-sm text-muted-foreground">
          Track inventory movement by product, voucher, and movement type.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Inward Quantity</p>
          <p className="mt-3 text-3xl font-bold text-foreground">{totalIn.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Outward Quantity</p>
          <p className="mt-3 text-3xl font-bold text-foreground">{totalOut.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Recent Movements</p>
          <p className="mt-3 text-3xl font-bold text-foreground">{movements.length}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Movement</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Voucher</th>
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No stock movements available.
                </td>
              </tr>
            ) : (
              movements.map((movement) => (
                <tr key={movement.stockMovementId} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{movement.productName || "Unknown product"}</td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">{movement.movementType}</td>
                  <td className="px-4 py-3 text-right text-foreground">{Number(movement.quantity ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-foreground">₹{Number(movement.rate ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-foreground">₹{Number(movement.amount ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{movement.voucherNo || "N/A"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
