import { db } from "@/lib/db";
import { mUnitsOfMeasurement } from "@/lib/db/schema";
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
    .select()
    .from(mUnitsOfMeasurement)
    .where(and(eq(mUnitsOfMeasurement.companyId, companyId), isNull(mUnitsOfMeasurement.deletedOn)))
    .orderBy(mUnitsOfMeasurement.unitCode);

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const companyId = Number(session.user.companyId);
  const userId = session.user.id;
  const { unitCode, unitName } = await request.json();

  if (!unitCode || !unitName) {
    return NextResponse.json({ error: "unitCode and unitName are required" }, { status: 400 });
  }

  const [row] = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(mUnitsOfMeasurement)
      .values({
        companyId,
        unitCode: unitCode.toUpperCase(),
        unitName,
        isFixed: false,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    await writeAuditLog(tx, {
      tableName: "m_units_of_measurement",
      recordId: Number(inserted.unitId),
      actionType: "create",
      newDataJson: inserted,
      createdBy: userId,
    });

    return [inserted];
  });

  return NextResponse.json(row, { status: 201 });
}
