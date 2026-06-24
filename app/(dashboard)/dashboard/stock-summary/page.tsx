import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mProducts, tStockMovements } from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import ExportButton from "@/components/ExportButton";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";

export default async function StockSummaryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const summary = await db
    .select({
      productId: mProducts.productId,
      productName: mProducts.productName,
      unit: mProducts.unit,
      openingStockQty: mProducts.openingStockQty,
      totalIn: sql<number>`coalesce(sum(case when ${tStockMovements.movementType} in ('purchase','opening') then ${tStockMovements.quantity} else 0 end), 0)`,
      totalOut: sql<number>`coalesce(sum(case when ${tStockMovements.movementType} = 'sale' then ${tStockMovements.quantity} else 0 end), 0)`,
      currentStock: sql<number>`coalesce(${mProducts.openingStockQty} + sum(case when ${tStockMovements.movementType} in ('purchase','opening') then ${tStockMovements.quantity} else 0 end) - sum(case when ${tStockMovements.movementType} = 'sale' then ${tStockMovements.quantity} else 0 end), ${mProducts.openingStockQty})`,
    })
    .from(mProducts)
    .leftJoin(tStockMovements, eq(mProducts.productId, tStockMovements.productId))
    .where(and(eq(mProducts.companyId, companyId), isNull(mProducts.deletedOn)))
    .groupBy(mProducts.productId, mProducts.productName, mProducts.unit, mProducts.openingStockQty)
    .orderBy(mProducts.productName);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "stock_summary");
  const canExport = p?.e ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stock Summary</h1>
          <p className="text-sm text-muted-foreground">
            Inventory position across products, opening stock, inward and outward movements.
          </p>
        </div>
        <ExportButton
          filename="stock_summary.csv"
          headers={["Product Name", "Unit", "Opening Qty", "Total In", "Total Out", "Current Stock"]}
          keys={["productName", "unit", "openingStockQty", "totalIn", "totalOut", "currentStock"]}
          rows={summary.map(r => ({
            ...r,
            openingStockQty: Number(r.openingStockQty ?? 0).toFixed(2),
            totalIn: Number(r.totalIn ?? 0).toFixed(2),
            totalOut: Number(r.totalOut ?? 0).toFixed(2),
            currentStock: Number(r.currentStock ?? 0).toFixed(2)
          }))}
          canExport={canExport}
        />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3 text-right">Opening Qty</th>
              <th className="px-4 py-3 text-right">Total In</th>
              <th className="px-4 py-3 text-right">Total Out</th>
              <th className="px-4 py-3 text-right">Current Stock</th>
            </tr>
          </thead>
          <tbody>
            {summary.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No products or stock movements available.
                </td>
              </tr>
            ) : (
              summary.map((row) => (
                <tr key={row.productId} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{row.productName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.unit}</td>
                  <td className="px-4 py-3 text-right text-foreground">{Number(row.openingStockQty ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-foreground">{Number(row.totalIn ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-foreground">{Number(row.totalOut ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">{Number(row.currentStock ?? 0).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
