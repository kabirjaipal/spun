import { db } from "@/lib/db";
import { mCustomers, mLedgers } from "@/lib/db/schema";
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
    .from(mCustomers)
    .where(and(eq(mCustomers.companyId, companyId), isNull(mCustomers.deletedOn)))
    .orderBy(mCustomers.customerName);

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const companyId = Number(session.user.companyId);
  const userId = session.user.id;
  const body = await request.json();
  const { customerName, gstNo, phone, email, address, openingBalance } = body;

  if (!customerName) return NextResponse.json({ error: "customerName is required" }, { status: 400 });

  const [customer] = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(mCustomers)
      .values({ companyId, customerName, gstNo, phone, email, address, openingBalance: String(openingBalance ?? 0), createdBy: userId, updatedBy: userId })
      .returning();

    // Auto-create a matching ledger (Tally-style)
    await tx.insert(mLedgers).values({
      companyId,
      ledgerName: customerName,
      ledgerType: "customer",
      referenceId: Number(c.customerId),
      createdBy: userId,
      updatedBy: userId,
    });

    // Write audit log
    await writeAuditLog(tx, {
      tableName: "m_customers",
      recordId: Number(c.customerId),
      actionType: "create",
      newDataJson: c,
      createdBy: userId,
    });

    return [c];
  });

  return NextResponse.json(customer, { status: 201 });
}
