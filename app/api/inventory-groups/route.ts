import { db } from "@/lib/db";
import { mInventoryGroups } from "@/lib/db/schema";
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
    .from(mInventoryGroups)
    .where(and(eq(mInventoryGroups.companyId, companyId), isNull(mInventoryGroups.deletedOn)))
    .orderBy(mInventoryGroups.groupName);

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const companyId = Number(session.user.companyId);
  const userId = session.user.id;
  const { groupName } = await request.json();

  if (!groupName) {
    return NextResponse.json({ error: "groupName is required" }, { status: 400 });
  }

  const [row] = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(mInventoryGroups)
      .values({
        companyId,
        groupName,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    await writeAuditLog(tx, {
      tableName: "m_inventory_groups",
      recordId: Number(inserted.inventoryGroupId),
      actionType: "create",
      newDataJson: inserted,
      createdBy: userId,
    });

    return [inserted];
  });

  return NextResponse.json(row, { status: 201 });
}
