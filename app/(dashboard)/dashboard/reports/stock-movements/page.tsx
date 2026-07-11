import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCompanies, mInventory, tStockMovements, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull, sql, or } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import StockMovementsClient from "./StockMovementsClient";

export default async function StockMovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; inventoryId?: string }>;
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

  // 2. Dynamic current FY (April start)
  const today = new Date();
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fromDate = params.from || `${fyStartYear}-04-01`;
  const toDate = params.to || `${fyStartYear + 1}-03-31`;

  // 3. Fetch all active inventory items for filter list
  const items = await db
    .select({
      inventoryId: mInventory.inventoryId,
      inventoryName: mInventory.inventoryName,
      unit: mInventory.unit,
    })
    .from(mInventory)
    .where(and(eq(mInventory.companyId, companyId), isNull(mInventory.deletedOn)))
    .orderBy(mInventory.inventoryName);

  // 4. Construct SQL clauses for movement query
  const whereClauses = [
    eq(tStockMovements.companyId, companyId),
    isNull(tStockMovements.deletedOn),
    or(
      isNull(tStockMovements.voucherId),
      isNull(tVouchers.deletedOn)
    )
  ];

  if (params.inventoryId) {
    whereClauses.push(eq(tStockMovements.inventoryId, Number(params.inventoryId)));
  }

  // Filter based on coalesced date from voucher or creation date
  whereClauses.push(
    sql`coalesce(${tVouchers.voucherDate}, cast(${tStockMovements.createdOn} as date)) >= ${fromDate}`
  );
  whereClauses.push(
    sql`coalesce(${tVouchers.voucherDate}, cast(${tStockMovements.createdOn} as date)) <= ${toDate}`
  );

  // 5. Query stock movements with filters applied
  const movements = await db
    .select({
      stockMovementId: tStockMovements.stockMovementId,
      inventoryId: tStockMovements.inventoryId,
      inventoryName: mInventory.inventoryName,
      unit: mInventory.unit,
      voucherId: tStockMovements.voucherId,
      movementType: tStockMovements.movementType,
      quantity: tStockMovements.quantity,
      rate: tStockMovements.rate,
      amount: tStockMovements.amount,
      createdOn: tStockMovements.createdOn,
      voucherDate: tVouchers.voucherDate,
      voucherNo: tVouchers.voucherNo,
      voucherType: tVouchers.voucherType,
    })
    .from(tStockMovements)
    .leftJoin(mInventory, eq(tStockMovements.inventoryId, mInventory.inventoryId))
    .leftJoin(tVouchers, eq(tStockMovements.voucherId, tVouchers.voucherId))
    .where(and(...whereClauses))
    .orderBy(sql`coalesce(${tVouchers.voucherDate}, cast(${tStockMovements.createdOn} as date))`);

  // 6. Permissions
  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "stock_movements");
  const canExport = p?.e ?? false;

  return (
    <StockMovementsClient
      company={{
        companyId: company.companyId,
        companyName: company.companyName,
        gstNo: company.gstNo,
        address: company.address,
      }}
      items={items.map((i) => ({
        inventoryId: Number(i.inventoryId),
        inventoryName: i.inventoryName,
        unit: i.unit,
      }))}
      movements={movements.map((m) => ({
        stockMovementId: m.stockMovementId,
        inventoryId: Number(m.inventoryId),
        inventoryName: m.inventoryName || "Unknown Item",
        unit: m.unit || "pcs",
        voucherId: m.voucherId ? Number(m.voucherId) : null,
        movementType: m.movementType,
        quantity: Number(m.quantity),
        rate: Number(m.rate),
        amount: Number(m.amount),
        voucherDate: m.voucherDate || m.createdOn.toISOString().split("T")[0],
        voucherNo: m.voucherNo,
        voucherType: m.voucherType,
      }))}
      canExport={canExport}
    />
  );
}

