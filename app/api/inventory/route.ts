import { db } from "@/lib/db";
import { mInventory, mTaxRates } from "@/lib/db/schema";
import { and, isNull, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const companyId = Number(session.user.companyId);

  const rows = await db
    .select({
      inventoryId: mInventory.inventoryId,
      inventoryCode: mInventory.inventoryCode,
      inventoryName: mInventory.inventoryName,
      unit: mInventory.unit,
      gstRateId: mInventory.gstRateId,
      openingStockQty: mInventory.openingStockQty,
      openingStockRate: mInventory.openingStockRate,
      taxName: mTaxRates.taxName,
      taxPercent: mTaxRates.taxPercent,
      hsnCode: mInventory.hsnCode,
      inventoryGroupId: mInventory.inventoryGroupId,
      inventoryCategoryId: mInventory.inventoryCategoryId,
      gstType: mInventory.gstType,
      gstPercent: mInventory.gstPercent,
      isConsumable: mInventory.isConsumable,
      consumeWithInventoryId: mInventory.consumeWithInventoryId,
      consumptionRatio: mInventory.consumptionRatio,
      shortagePercent: mInventory.shortagePercent,
    })
    .from(mInventory)
    .leftJoin(mTaxRates, eq(mInventory.gstRateId, mTaxRates.taxRateId))
    .where(and(eq(mInventory.companyId, companyId), isNull(mInventory.deletedOn)))
    .orderBy(mInventory.inventoryName);

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const companyId = Number(session.user.companyId);
  const userId = session.user.id;
  const {
    inventoryCode,
    inventoryName,
    unit,
    gstRateId,
    openingStockQty,
    openingStockRate,
    hsnCode,
    inventoryGroupId,
    inventoryCategoryId,
    gstType,
    gstPercent,
    isConsumable,
    consumeWithInventoryId,
    consumptionRatio,
    shortagePercent,
  } = await request.json();

  if (!inventoryCode || !inventoryName || !unit) {
    return NextResponse.json({ error: "inventoryCode, inventoryName, and unit are required" }, { status: 400 });
  }

  const [row] = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(mInventory)
      .values({
        companyId,
        inventoryCode,
        inventoryName,
        unit,
        gstRateId: gstRateId ? Number(gstRateId) : null,
        openingStockQty: String(openingStockQty ?? 0),
        openingStockRate: String(openingStockRate ?? 0),
        hsnCode: hsnCode || null,
        inventoryGroupId: inventoryGroupId ? Number(inventoryGroupId) : null,
        inventoryCategoryId: inventoryCategoryId ? Number(inventoryCategoryId) : null,
        gstType: gstType || null,
        gstPercent: gstPercent ? String(gstPercent) : null,
        isConsumable: !!isConsumable,
        consumeWithInventoryId: consumeWithInventoryId ? Number(consumeWithInventoryId) : null,
        consumptionRatio: consumptionRatio ? String(consumptionRatio) : null,
        shortagePercent: shortagePercent ? String(shortagePercent) : null,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    await writeAuditLog(tx, {
      tableName: "m_inventory",
      recordId: Number(inserted.inventoryId),
      actionType: "create",
      newDataJson: inserted,
      createdBy: userId,
    });

    return [inserted];
  });

  return NextResponse.json(row, { status: 201 });
}
