import { db } from "@/lib/db";
import { mUnitsOfMeasurement } from "@/lib/db/schema";
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
  const { unitCode, unitName } = await request.json();

  const [row] = await db.transaction(async (tx) => {
    const oldU = await tx.query.mUnitsOfMeasurement.findFirst({
      where: and(eq(mUnitsOfMeasurement.unitId, Number(id)), eq(mUnitsOfMeasurement.companyId, companyId))
    });

    const [updated] = await tx
      .update(mUnitsOfMeasurement)
      .set({
        unitCode: unitCode ? unitCode.toUpperCase() : undefined,
        unitName,
        updatedBy: userId,
        updatedOn: new Date(),
      })
      .where(and(eq(mUnitsOfMeasurement.unitId, Number(id)), eq(mUnitsOfMeasurement.companyId, companyId)))
      .returning();

    if (updated) {
      await writeAuditLog(tx, {
        tableName: "m_units_of_measurement",
        recordId: Number(id),
        actionType: "update",
        oldDataJson: oldU || null,
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

  const [error] = await db.transaction(async (tx) => {
    const oldU = await tx.query.mUnitsOfMeasurement.findFirst({
      where: and(eq(mUnitsOfMeasurement.unitId, Number(id)), eq(mUnitsOfMeasurement.companyId, companyId))
    });

    if (oldU?.isFixed) {
      return ["Cannot delete system-default units of measurement"];
    }

    await tx
      .update(mUnitsOfMeasurement)
      .set({ deletedOn: now, deletedBy: userId })
      .where(and(eq(mUnitsOfMeasurement.unitId, Number(id)), eq(mUnitsOfMeasurement.companyId, companyId)));

    await writeAuditLog(tx, {
      tableName: "m_units_of_measurement",
      recordId: Number(id),
      actionType: "delete",
      oldDataJson: oldU || null,
      newDataJson: { deletedOn: now, deletedBy: userId },
      createdBy: userId,
    });
    return [];
  });

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
