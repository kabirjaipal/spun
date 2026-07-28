import { db } from "@/lib/db";
import { tVouchers, tVoucherEntries, tVoucherItems, tStockMovements } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { POST as vouchersPostHandler } from "../route";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    body.voucherId = Number(id);

    const newReq = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(body),
    });

    return vouchersPostHandler(newReq);
  } catch (error: any) {
    console.error("Voucher patch handler delegation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delegate patch update" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  const { id } = await params;
  const voucherIdNum = Number(id);
  const companyId = Number(session.user.companyId);
  const userId = session.user.id;

  try {
    const deletedVoucher = await db.transaction(async (tx) => {
      const oldVoucher = await tx.query.tVouchers.findFirst({
        where: and(
          eq(tVouchers.voucherId, voucherIdNum),
          eq(tVouchers.companyId, companyId),
          isNull(tVouchers.deletedOn)
        ),
      });

      if (!oldVoucher) {
        throw new Error("Voucher not found or unauthorized");
      }

      // Soft delete
      const [v] = await tx
        .update(tVouchers)
        .set({
          deletedOn: new Date(),
          deletedBy: userId,
        })
        .where(eq(tVouchers.voucherId, voucherIdNum))
        .returning();

      await tx
        .update(tVoucherEntries)
        .set({
          deletedOn: new Date(),
          deletedBy: userId,
        })
        .where(eq(tVoucherEntries.voucherId, voucherIdNum));

      await tx
        .update(tVoucherItems)
        .set({
          deletedOn: new Date(),
          deletedBy: userId,
        })
        .where(eq(tVoucherItems.voucherId, voucherIdNum));

      await tx
        .update(tStockMovements)
        .set({
          deletedOn: new Date(),
          deletedBy: userId,
        })
        .where(eq(tStockMovements.voucherId, voucherIdNum));

      // Log Audit Trail
      await writeAuditLog(tx, {
        tableName: "t_vouchers",
        recordId: voucherIdNum,
        actionType: "delete",
        oldDataJson: oldVoucher,
        newDataJson: null,
        createdBy: userId,
      });

      return [v];
    });

    return NextResponse.json({ success: true, voucher: deletedVoucher });
  } catch (error: any) {
    console.error("Voucher delete error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete voucher" },
      { status: 500 }
    );
  }
}
