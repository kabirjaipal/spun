import { db } from "@/lib/db";
import { mLedgers, mProducts, mTaxRates, mCustomers, tVouchers, tVoucherEntries, tStockMovements } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  const userId = session.user.id;
  const companyId = Number(session.user.companyId);
  const body = await request.json();
  const { voucherType, voucherNo, voucherDate, partyId, remarks, lineItems } = body;

  if (!voucherType || !voucherNo || !voucherDate || !partyId || !Array.isArray(lineItems) || lineItems.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const [voucher] = await db.transaction(async (tx) => {
      const [createdVoucher] = await tx
        .insert(tVouchers)
        .values({
          companyId,
          voucherType,
          voucherNo,
          voucherDate,
          partyId: Number(partyId),
          remarks: remarks || null,
          status: "posted",
          totalAmount: String(lineItems.reduce((sum: number, line: any) => sum + ((Number(line.quantity) || 0) * (Number(line.rate) || 0)), 0)),
          taxAmount: String(lineItems.reduce((sum: number, line: any) => {
            const amount = (Number(line.quantity) || 0) * (Number(line.rate) || 0);
            const gstRate = Number(line.gstRateId || 0);
            return sum + Math.round((amount * gstRate) / 100 * 100) / 100;
          }, 0)),
          netAmount: String(lineItems.reduce((sum: number, line: any) => {
            const amount = (Number(line.quantity) || 0) * (Number(line.rate) || 0);
            const gstRate = Number(line.gstRateId || 0);
            return sum + amount + Math.round((amount * gstRate) / 100 * 100) / 100;
          }, 0)),
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      const entries = await Promise.all(lineItems.map(async (line: any) => {
        const taxRate = line.gstRateId ? await tx.query.mTaxRates.findFirst({ where: eq(mTaxRates.taxRateId, Number(line.gstRateId)) }) : null;
        const product = await tx.query.mProducts.findFirst({ where: eq(mProducts.productId, Number(line.productId)) });
        const ledgerId = product ? product.gstRateId ? Number(line.ledgerId || 0) : Number(line.ledgerId || 0) : Number(line.ledgerId || 0);
        const amount = (Number(line.quantity) || 0) * (Number(line.rate) || 0);

        return tx.insert(tVoucherEntries).values({
          voucherId: Number(createdVoucher.voucherId),
          ledgerId: Number(line.ledgerId || 0),
          entryType: line.entryType || "debit",
          amount: String(amount),
          createdBy: userId,
          updatedBy: userId,
        });
      }));

      const stockMovements = await Promise.all(lineItems.map(async (line: any) => {
        const product = await tx.query.mProducts.findFirst({ where: eq(mProducts.productId, Number(line.productId)) });
        if (!product) return null;
        const amount = (Number(line.quantity) || 0) * (Number(line.rate) || 0);
        return tx.insert(tStockMovements).values({
          companyId,
          productId: Number(product.productId),
          voucherId: Number(createdVoucher.voucherId),
          movementType: "sale",
          quantity: String(Number(line.quantity) || 0),
          rate: String(Number(line.rate) || 0),
          amount: String(amount),
          createdBy: userId,
          updatedBy: userId,
        });
      }));

      return [createdVoucher];
    });

    return NextResponse.json(voucher, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create voucher" }, { status: 500 });
  }
}
