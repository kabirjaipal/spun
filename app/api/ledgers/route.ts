import { db } from "@/lib/db";
import { mLedgers } from "@/lib/db/schema";
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
    .from(mLedgers)
    .where(and(eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn)))
    .orderBy(mLedgers.ledgerName);

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const companyId = Number(session.user.companyId);
  const userId = session.user.id;
  const { ledgerName, ledgerType } = await request.json();

  if (!ledgerName || !ledgerType) {
    return NextResponse.json({ error: "ledgerName and ledgerType are required" }, { status: 400 });
  }

  const [row] = await db
    .insert(mLedgers)
    .values({ companyId, ledgerName, ledgerType, createdBy: userId, updatedBy: userId })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
