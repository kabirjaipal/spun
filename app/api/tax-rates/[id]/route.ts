import { db } from "@/lib/db";
import { mTaxRates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { taxName, taxPercent } = await request.json();

  const [row] = await db.transaction(async (tx) => {
    const oldT = await tx.query.mTaxRates.findFirst({
      where: eq(mTaxRates.taxRateId, Number(id))
    });

    const [updated] = await tx
      .update(mTaxRates)
      .set({ taxName, taxPercent: String(taxPercent), updatedBy: session.user.id, updatedOn: new Date() })
      .where(eq(mTaxRates.taxRateId, Number(id)))
      .returning();

    if (updated) {
      await writeAuditLog(tx, {
        tableName: "m_tax_rates",
        recordId: Number(id),
        actionType: "update",
        oldDataJson: oldT || null,
        newDataJson: updated,
        createdBy: session.user.id,
      });
    }

    return [updated];
  });

  return NextResponse.json(row);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const now = new Date();

  await db.transaction(async (tx) => {
    const oldT = await tx.query.mTaxRates.findFirst({
      where: eq(mTaxRates.taxRateId, Number(id))
    });

    await tx
      .update(mTaxRates)
      .set({ deletedOn: now, deletedBy: session.user.id })
      .where(eq(mTaxRates.taxRateId, Number(id)));

    await writeAuditLog(tx, {
      tableName: "m_tax_rates",
      recordId: Number(id),
      actionType: "delete",
      oldDataJson: oldT || null,
      newDataJson: { deletedOn: now, deletedBy: session.user.id },
      createdBy: session.user.id,
    });
  });

  return NextResponse.json({ success: true });
}
