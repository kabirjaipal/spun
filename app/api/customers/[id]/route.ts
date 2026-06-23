import { db } from "@/lib/db";
import { mCustomers, mLedgers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { id } = await params;
  const companyId = Number(session.user.companyId);
  const userId = session.user.id;
  const { customerName, gstNo, phone, email, address, openingBalance } = await request.json();

  const [customer] = await db.transaction(async (tx) => {
    const [c] = await tx
      .update(mCustomers)
      .set({ customerName, gstNo, phone, email, address, openingBalance: String(openingBalance), updatedBy: userId, updatedOn: new Date() })
      .where(and(eq(mCustomers.customerId, Number(id)), eq(mCustomers.companyId, companyId)))
      .returning();

    // Keep ledger name in sync
    if (customerName) {
      await tx
        .update(mLedgers)
        .set({ ledgerName: customerName, updatedBy: userId, updatedOn: new Date() })
        .where(and(eq(mLedgers.referenceId, Number(id)), eq(mLedgers.ledgerType, "customer"), eq(mLedgers.companyId, companyId)));
    }

    return [c];
  });

  return NextResponse.json(customer);
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
    await tx
      .update(mCustomers)
      .set({ deletedOn: now, deletedBy: userId })
      .where(and(eq(mCustomers.customerId, Number(id)), eq(mCustomers.companyId, companyId)));

    await tx
      .update(mLedgers)
      .set({ deletedOn: now, deletedBy: userId })
      .where(and(eq(mLedgers.referenceId, Number(id)), eq(mLedgers.ledgerType, "customer"), eq(mLedgers.companyId, companyId)));
  });

  return NextResponse.json({ success: true });
}
