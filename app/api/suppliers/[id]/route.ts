import { db } from "@/lib/db";
import { mSuppliers, mLedgers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { id } = await params;
  const companyId = BigInt(session.user.companyId);
  const userId = session.user.id;
  const { supplierName, gstNo, phone, email, address, openingBalance } = await request.json();

  const [supplier] = await db.transaction(async (tx) => {
    const [s] = await tx
      .update(mSuppliers)
      .set({ supplierName, gstNo, phone, email, address, openingBalance: String(openingBalance), updatedBy: userId, updatedOn: new Date() })
      .where(and(eq(mSuppliers.supplierId, Number(id)), eq(mSuppliers.companyId, companyId)))
      .returning();

    if (supplierName) {
      await tx
        .update(mLedgers)
        .set({ ledgerName: supplierName, updatedBy: userId, updatedOn: new Date() })
        .where(and(eq(mLedgers.referenceId, BigInt(id)), eq(mLedgers.ledgerType, "supplier"), eq(mLedgers.companyId, companyId)));
    }

    return [s];
  });

  return NextResponse.json(supplier);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { id } = await params;
  const companyId = BigInt(session.user.companyId);
  const userId = session.user.id;
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(mSuppliers)
      .set({ deletedOn: now, deletedBy: userId })
      .where(and(eq(mSuppliers.supplierId, Number(id)), eq(mSuppliers.companyId, companyId)));

    await tx
      .update(mLedgers)
      .set({ deletedOn: now, deletedBy: userId })
      .where(and(eq(mLedgers.referenceId, BigInt(id)), eq(mLedgers.ledgerType, "supplier"), eq(mLedgers.companyId, companyId)));
  });

  return NextResponse.json({ success: true });
}
