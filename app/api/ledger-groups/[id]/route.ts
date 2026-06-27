import { db } from "@/lib/db";
import { mLedgerGroups } from "@/lib/db/schema";
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
  const { groupName, parentGroupId } = await request.json();

  const [row] = await db
    .update(mLedgerGroups)
    .set({
      groupName,
      parentGroupId: parentGroupId ? Number(parentGroupId) : null,
      updatedBy: userId,
      updatedOn: new Date(),
    })
    .where(and(eq(mLedgerGroups.groupId, Number(id)), eq(mLedgerGroups.companyId, companyId)))
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
    .update(mLedgerGroups)
    .set({ deletedOn: new Date(), deletedBy: userId })
    .where(and(eq(mLedgerGroups.groupId, Number(id)), eq(mLedgerGroups.companyId, companyId)));

  return NextResponse.json({ success: true });
}
