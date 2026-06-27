import { db } from "@/lib/db";
import { mLedgerGroups } from "@/lib/db/schema";
import { and, isNull, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const companyId = Number(session.user.companyId);

  const rows = await db
    .select()
    .from(mLedgerGroups)
    .where(and(eq(mLedgerGroups.companyId, companyId), isNull(mLedgerGroups.deletedOn)))
    .orderBy(mLedgerGroups.groupName);

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const companyId = Number(session.user.companyId);
  const userId = session.user.id;
  const { groupName, parentGroupId } = await request.json();

  if (!groupName) {
    return NextResponse.json({ error: "groupName is required" }, { status: 400 });
  }

  const [row] = await db
    .insert(mLedgerGroups)
    .values({
      companyId,
      groupName,
      parentGroupId: parentGroupId ? Number(parentGroupId) : null,
      isSystem: false,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
