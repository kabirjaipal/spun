import { db } from "@/lib/db";
import { mProducts, mTaxRates } from "@/lib/db/schema";
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
    .select({
      productId: mProducts.productId,
      productCode: mProducts.productCode,
      productName: mProducts.productName,
      unit: mProducts.unit,
      gstRateId: mProducts.gstRateId,
      openingStockQty: mProducts.openingStockQty,
      openingStockRate: mProducts.openingStockRate,
      taxName: mTaxRates.taxName,
      taxPercent: mTaxRates.taxPercent,
    })
    .from(mProducts)
    .leftJoin(mTaxRates, eq(mProducts.gstRateId, mTaxRates.taxRateId))
    .where(and(eq(mProducts.companyId, companyId), isNull(mProducts.deletedOn)))
    .orderBy(mProducts.productName);

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const companyId = Number(session.user.companyId);
  const userId = session.user.id;
  const { productCode, productName, unit, gstRateId, openingStockQty, openingStockRate } = await request.json();

  if (!productCode || !productName || !unit) {
    return NextResponse.json({ error: "productCode, productName, and unit are required" }, { status: 400 });
  }

  const [row] = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(mProducts)
      .values({
        companyId,
        productCode,
        productName,
        unit,
        gstRateId: gstRateId ? Number(gstRateId) : null,
        openingStockQty: String(openingStockQty ?? 0),
        openingStockRate: String(openingStockRate ?? 0),
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    await writeAuditLog(tx, {
      tableName: "m_products",
      recordId: Number(inserted.productId),
      actionType: "create",
      newDataJson: inserted,
      createdBy: userId,
    });

    return [inserted];
  });

  return NextResponse.json(row, { status: 201 });
}
