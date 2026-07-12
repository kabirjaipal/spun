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
  const {
    ledgerName,
    ledgerType,
    shortName,
    address,
    groupId,
    gstNo,
    msmeType,
    panNo,
    isTdsApplicable,
    tdsRate,
    creditDays,
    rateOfInterest,
    stateCode,
  } = await request.json();

  if (!ledgerName || !ledgerType) {
    return NextResponse.json({ error: "ledgerName and ledgerType are required" }, { status: 400 });
  }

  const [row] = await db
    .insert(mLedgers)
    .values({
      companyId,
      ledgerName,
      ledgerType,
      shortName: shortName || null,
      address: address || null,
      groupId: groupId ? Number(groupId) : null,
      gstNo: gstNo || null,
      msmeType: msmeType || null,
      panNo: panNo || null,
      isTdsApplicable: !!isTdsApplicable,
      tdsRate: tdsRate && !isNaN(Number(tdsRate)) ? String(Number(tdsRate).toFixed(2)) : "0.00",
      creditDays: creditDays && !isNaN(Number(creditDays)) ? Math.round(Number(creditDays)) : 0,
      rateOfInterest: rateOfInterest && !isNaN(Number(rateOfInterest)) ? String(Number(rateOfInterest).toFixed(2)) : "0.00",
      stateCode: stateCode || null,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
