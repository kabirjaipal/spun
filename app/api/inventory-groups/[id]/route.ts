import { db } from "@/lib/db";
import { mInventoryGroups } from "@/lib/db/schema";
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
  const { groupName } = await request.json();

  const [row] = await db.transaction(async (tx) => {
    const oldG = await tx.query.mInventoryGroups.findFirst({
      where: and(eq(mInventoryGroups.inventoryGroupId, Number(id)), eq(mInventoryGroups.companyId, companyId))
    });

    const [updated] = await tx
      .update(mInventoryGroups)
      .set({
        groupName,
        updatedBy: userId,
        updatedOn: new Date(),
      })
      .where(and(eq(mInventoryGroups.inventoryGroupId, Number(id)), eq(mInventoryGroups.companyId, companyId)))
      .returning();

    if (updated) {
      await writeAuditLog(tx, {
        tableName: "m_inventory_groups",
        recordId: Number(id),
        actionType: "update",
        oldDataJson: oldG || null,
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
    const oldG = await tx.query.mInventoryGroups.findFirst({
      where: and(eq(mInventoryGroups.inventoryGroupId, Number(id)), eq(mInventoryGroups.companyId, companyId))
    });

    await tx
      .update(mInventoryGroups)
      .set({ deletedOn: now, deletedBy: userId })
      .where(and(eq(mInventoryGroups.inventoryGroupId, Number(id)), eq(mInventoryGroups.companyId, companyId)));

    await writeAuditLog(tx, {
      tableName: "m_inventory_groups",
      recordId: Number(id),
      actionType: "delete",
      oldDataJson: oldG || null,
      newDataJson: { deletedOn: now, deletedBy: userId },
      createdBy: userId,
    });
  });

  return NextResponse.json({ success: true });
}
