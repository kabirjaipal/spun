import { db } from "@/lib/db";
import { mInventory, tVoucherItems, tVouchers } from "@/lib/db/schema";
import { and, isNull, eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const companyId = Number(session.user.companyId);
  const { searchParams } = new URL(request.url);
  const inventoryId = searchParams.get("inventoryId");

  if (!inventoryId) {
    return NextResponse.json({ error: "inventoryId is required" }, { status: 400 });
  }

  // 1. Check tVoucherItems for the last transaction rate
  const lastItem = await db
    .select({
      rate: tVoucherItems.rate,
    })
    .from(tVoucherItems)
    .innerJoin(tVouchers, eq(tVoucherItems.voucherId, tVouchers.voucherId))
    .where(
      and(
        eq(tVouchers.companyId, companyId),
        eq(tVoucherItems.inventoryId, Number(inventoryId)),
        isNull(tVoucherItems.deletedOn)
      )
    )
    .orderBy(desc(tVouchers.voucherDate), desc(tVouchers.voucherId))
    .limit(1)
    .then((rows) => rows[0]);

  if (lastItem) {
    return NextResponse.json({ rate: Number(lastItem.rate) });
  }

  // 2. Fallback to openingStockRate
  const inv = await db.query.mInventory.findFirst({
    where: and(eq(mInventory.inventoryId, Number(inventoryId)), eq(mInventory.companyId, companyId)),
  });

  return NextResponse.json({ rate: inv ? Number(inv.openingStockRate || 0) : 0 });
}
