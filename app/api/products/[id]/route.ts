import { db } from "@/lib/db";
import { mProducts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { id } = await params;
  const companyId = Number(session.user.companyId);
  const userId = session.user.id;
  const {
    productCode,
    productName,
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
    consumeWithProductId,
    consumptionRatio,
    shortagePercent,
  } = await request.json();

  const [row] = await db.transaction(async (tx) => {
    const oldP = await tx.query.mProducts.findFirst({
      where: and(eq(mProducts.productId, Number(id)), eq(mProducts.companyId, companyId))
    });

    const [updated] = await tx
      .update(mProducts)
      .set({
        productCode,
        productName,
        unit,
        gstRateId: gstRateId ? Number(gstRateId) : null,
        openingStockQty: String(openingStockQty),
        openingStockRate: String(openingStockRate),
        hsnCode: hsnCode || null,
        inventoryGroupId: inventoryGroupId ? Number(inventoryGroupId) : null,
        inventoryCategoryId: inventoryCategoryId ? Number(inventoryCategoryId) : null,
        gstType: gstType || null,
        gstPercent: gstPercent ? String(gstPercent) : null,
        isConsumable: !!isConsumable,
        consumeWithProductId: consumeWithProductId ? Number(consumeWithProductId) : null,
        consumptionRatio: consumptionRatio ? String(consumptionRatio) : null,
        shortagePercent: shortagePercent ? String(shortagePercent) : null,
        updatedBy: userId,
        updatedOn: new Date(),
      })
      .where(and(eq(mProducts.productId, Number(id)), eq(mProducts.companyId, companyId)))
      .returning();

    if (updated) {
      await writeAuditLog(tx, {
        tableName: "m_products",
        recordId: Number(id),
        actionType: "update",
        oldDataJson: oldP || null,
        newDataJson: updated,
        createdBy: userId,
      });
    }

    return [updated];
  });

  return NextResponse.json(row);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { id } = await params;
  const companyId = Number(session.user.companyId);
  const userId = session.user.id;
  const now = new Date();

  await db.transaction(async (tx) => {
    const oldP = await tx.query.mProducts.findFirst({
      where: and(eq(mProducts.productId, Number(id)), eq(mProducts.companyId, companyId))
    });

    await tx
      .update(mProducts)
      .set({ deletedOn: now, deletedBy: userId })
      .where(and(eq(mProducts.productId, Number(id)), eq(mProducts.companyId, companyId)));

    await writeAuditLog(tx, {
      tableName: "m_products",
      recordId: Number(id),
      actionType: "delete",
      oldDataJson: oldP || null,
      newDataJson: { deletedOn: now, deletedBy: userId },
      createdBy: userId,
    });
  });

  return NextResponse.json({ success: true });
}
