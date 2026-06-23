import { db } from "@/lib/db";
import { mLedgers } from "@/lib/db/schema";
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
  const { ledgerName, ledgerType } = await request.json();

  const [row] = await db
    .update(mLedgers)
    .set({ ledgerName, ledgerType, updatedBy: userId, updatedOn: new Date() })
    .where(and(eq(mLedgers.ledgerId, Number(id)), eq(mLedgers.companyId, companyId)))
    .returning();

  return NextResponse.json(row);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { id } = await params;
  const companyId = Number(session.user.companyId);
  const userId = session.user.id;

  await db
    .update(mLedgers)
    .set({ deletedOn: new Date(), deletedBy: userId })
    .where(and(eq(mLedgers.ledgerId, Number(id)), eq(mLedgers.companyId, companyId)));

  return NextResponse.json({ success: true });
}
