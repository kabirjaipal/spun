import { db } from "@/lib/db";
import { mBrokersHaste } from "@/lib/db/schema";
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
  const { name, type } = await request.json();

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const [row] = await db.transaction(async (tx) => {
    const old = await tx.query.mBrokersHaste.findFirst({
      where: and(eq(mBrokersHaste.id, Number(id)), eq(mBrokersHaste.companyId, companyId))
    });

    const updateData: Record<string, any> = {
      name: name.trim(),
      updatedBy: userId,
      updatedOn: new Date(),
    };
    if (type && (type === "broker" || type === "haste")) {
      updateData.type = type;
    }

    const [updated] = await tx
      .update(mBrokersHaste)
      .set(updateData)
      .where(and(eq(mBrokersHaste.id, Number(id)), eq(mBrokersHaste.companyId, companyId)))
      .returning();

    if (updated) {
      await writeAuditLog(tx, {
        tableName: "m_brokers_haste",
        recordId: Number(id),
        actionType: "update",
        oldDataJson: old || null,
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
    const old = await tx.query.mBrokersHaste.findFirst({
      where: and(eq(mBrokersHaste.id, Number(id)), eq(mBrokersHaste.companyId, companyId))
    });

    await tx
      .update(mBrokersHaste)
      .set({ deletedOn: now, deletedBy: userId })
      .where(and(eq(mBrokersHaste.id, Number(id)), eq(mBrokersHaste.companyId, companyId)));

    await writeAuditLog(tx, {
      tableName: "m_brokers_haste",
      recordId: Number(id),
      actionType: "delete",
      oldDataJson: old || null,
      newDataJson: { deletedOn: now, deletedBy: userId },
      createdBy: userId,
    });
  });

  return NextResponse.json({ success: true });
}
