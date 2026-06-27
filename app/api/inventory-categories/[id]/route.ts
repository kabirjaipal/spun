import { db } from "@/lib/db";
import { mInventoryCategories } from "@/lib/db/schema";
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
  const { categoryName } = await request.json();

  const [row] = await db.transaction(async (tx) => {
    const oldC = await tx.query.mInventoryCategories.findFirst({
      where: and(eq(mInventoryCategories.inventoryCategoryId, Number(id)), eq(mInventoryCategories.companyId, companyId))
    });

    const [updated] = await tx
      .update(mInventoryCategories)
      .set({
        categoryName,
        updatedBy: userId,
        updatedOn: new Date(),
      })
      .where(and(eq(mInventoryCategories.inventoryCategoryId, Number(id)), eq(mInventoryCategories.companyId, companyId)))
      .returning();

    if (updated) {
      await writeAuditLog(tx, {
        tableName: "m_inventory_categories",
        recordId: Number(id),
        actionType: "update",
        oldDataJson: oldC || null,
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
    const oldC = await tx.query.mInventoryCategories.findFirst({
      where: and(eq(mInventoryCategories.inventoryCategoryId, Number(id)), eq(mInventoryCategories.companyId, companyId))
    });

    await tx
      .update(mInventoryCategories)
      .set({ deletedOn: now, deletedBy: userId })
      .where(and(eq(mInventoryCategories.inventoryCategoryId, Number(id)), eq(mInventoryCategories.companyId, companyId)));

    await writeAuditLog(tx, {
      tableName: "m_inventory_categories",
      recordId: Number(id),
      actionType: "delete",
      oldDataJson: oldC || null,
      newDataJson: { deletedOn: now, deletedBy: userId },
      createdBy: userId,
    });
  });

  return NextResponse.json({ success: true });
}
