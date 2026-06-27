import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mInventory, tStockMovements, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull, desc } from "drizzle-orm";
import ExportButton from "@/components/ExportButton";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";

export default async function StockMovementsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const movements = await db
    .select({
      stockMovementId: tStockMovements.stockMovementId,
      inventoryName: mInventory.inventoryName,
      movementType: tStockMovements.movementType,
      quantity: tStockMovements.quantity,
      rate: tStockMovements.rate,
      amount: tStockMovements.amount,
      voucherNo: tVouchers.voucherNo,
      voucherDate: tVouchers.voucherDate,
    })
    .from(tStockMovements)
    .leftJoin(mInventory, eq(tStockMovements.inventoryId, mInventory.inventoryId))
    .leftJoin(tVouchers, eq(tStockMovements.voucherId, tVouchers.voucherId))
    .where(and(eq(tStockMovements.companyId, companyId), isNull(mInventory.deletedOn)))
    .orderBy(desc(tStockMovements.createdOn))
    .limit(20);

  const totalIn = movements.reduce(
    (sum, item) => sum + (item.movementType === "purchase" || item.movementType === "opening" ? Number(item.quantity ?? 0) : 0),
    0
  );
  const totalOut = movements.reduce(
    (sum, item) => sum + (item.movementType === "sale" ? Number(item.quantity ?? 0) : 0),
    0
  );

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "stock_movements");
  const canExport = p?.e ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stock Movements</h1>
          <p className="text-sm text-muted-foreground">
            Track inventory movement by item, voucher, and movement type.
          </p>
        </div>
        <ExportButton
          filename="stock_movements.csv"
          headers={["Item Name", "Movement Type", "Quantity", "Rate", "Amount", "Voucher No", "Voucher Date"]}
          keys={["inventoryName", "movementType", "quantity", "rate", "amount", "voucherNo", "voucherDate"]}
          rows={movements.map(m => ({
            ...m,
            voucherDate: m.voucherDate ? String(m.voucherDate) : ""
          }))}
          canExport={canExport}
        />
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
          <thead className="bg-muted/40 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Item</th>
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
                  <td className="px-4 py-3 font-medium text-foreground">{movement.inventoryName || "Unknown item"}</td>
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
