import { db } from "@/lib/db";
import { mBrokersHaste } from "@/lib/db/schema";
import { and, isNull, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const companyId = Number(session.user.companyId);
  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get("type");

  const conditions = [eq(mBrokersHaste.companyId, companyId), isNull(mBrokersHaste.deletedOn)];
  if (typeFilter === "broker" || typeFilter === "haste") {
    conditions.push(eq(mBrokersHaste.type, typeFilter));
  }

  const rows = await db
    .select()
    .from(mBrokersHaste)
    .where(and(...conditions))
    .orderBy(mBrokersHaste.name);

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const companyId = Number(session.user.companyId);
  const userId = session.user.id;
  const { name, type } = await request.json();

  if (!name || !type) {
    return NextResponse.json({ error: "name and type are required" }, { status: 400 });
  }

  if (type !== "broker" && type !== "haste") {
    return NextResponse.json({ error: "type must be 'broker' or 'haste'" }, { status: 400 });
  }

  const [row] = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(mBrokersHaste)
      .values({
        companyId,
        name: name.trim(),
        type,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    await writeAuditLog(tx, {
      tableName: "m_brokers_haste",
      recordId: Number(inserted.id),
      actionType: "create",
      newDataJson: inserted,
      createdBy: userId,
    });

    return [inserted];
  });

  return NextResponse.json(row, { status: 201 });
}
