import { db } from "@/lib/db";
import { mSuppliers, mLedgers } from "@/lib/db/schema";
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
    .from(mSuppliers)
    .where(and(eq(mSuppliers.companyId, companyId), isNull(mSuppliers.deletedOn)))
    .orderBy(mSuppliers.supplierName);

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const companyId = Number(session.user.companyId);
  const userId = session.user.id;
  const { supplierName, gstNo, phone, email, address, openingBalance } = await request.json();

  if (!supplierName) return NextResponse.json({ error: "supplierName is required" }, { status: 400 });

  const [supplier] = await db.transaction(async (tx) => {
    const [s] = await tx
      .insert(mSuppliers)
      .values({ companyId, supplierName, gstNo, phone, email, address, openingBalance: String(openingBalance ?? 0), createdBy: userId, updatedBy: userId })
      .returning();

    await tx.insert(mLedgers).values({
      companyId,
      ledgerName: supplierName,
      ledgerType: "supplier",
      referenceId: Number(s.supplierId),
      createdBy: userId,
      updatedBy: userId,
    });

    // Write audit log
    await writeAuditLog(tx, {
      tableName: "m_suppliers",
      recordId: Number(s.supplierId),
      actionType: "create",
      newDataJson: s,
      createdBy: userId,
    });

    return [s];
  });

  return NextResponse.json(supplier, { status: 201 });
}
