import { db } from "@/lib/db";
import { mProducts } from "@/lib/db/schema";
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
  const { productCode, productName, unit, gstRateId, openingStockQty, openingStockRate } = await request.json();

  const [row] = await db
    .update(mProducts)
    .set({
      productCode,
      productName,
      unit,
      gstRateId: gstRateId ? Number(gstRateId) : null,
      openingStockQty: String(openingStockQty),
      openingStockRate: String(openingStockRate),
      updatedBy: userId,
      updatedOn: new Date(),
    })
    .where(and(eq(mProducts.productId, Number(id)), eq(mProducts.companyId, companyId)))
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
    .update(mProducts)
    .set({ deletedOn: new Date(), deletedBy: userId })
    .where(and(eq(mProducts.productId, Number(id)), eq(mProducts.companyId, companyId)));

  return NextResponse.json({ success: true });
}
