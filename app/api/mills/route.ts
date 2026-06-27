import { db } from "@/lib/db";
import { mMills } from "@/lib/db/schema";
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
    .from(mMills)
    .where(and(eq(mMills.companyId, companyId), isNull(mMills.deletedOn)))
    .orderBy(mMills.millName);

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const companyId = Number(session.user.companyId);
  const userId = session.user.id;
  const {
    millName,
    address,
    gstNo,
    gstType,
    city,
    stateCode,
    phone,
    msmeRegistered,
    msmeType,
  } = await request.json();

  if (!millName) {
    return NextResponse.json({ error: "millName is required" }, { status: 400 });
  }

  const [row] = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(mMills)
      .values({
        companyId,
        millName,
        address: address || null,
        gstNo: gstNo ? gstNo.trim().toUpperCase() : null,
        gstType: gstType || "unregistered",
        city: city || null,
        stateCode: stateCode || null,
        phone: phone || null,
        msmeRegistered: !!msmeRegistered,
        msmeType: msmeType || "non_registered",
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    await writeAuditLog(tx, {
      tableName: "m_mills",
      recordId: Number(inserted.millId),
      actionType: "create",
      newDataJson: inserted,
      createdBy: userId,
    });

    return [inserted];
  });

  return NextResponse.json(row, { status: 201 });
}
