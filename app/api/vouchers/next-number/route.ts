import { db } from "@/lib/db";
import { mVoucherSequences } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

const DEFAULT_PREFIXES: Record<string, string> = {
  sale: "S-",
  purchase: "P-",
  purchase_return: "PR-",
  credit_note: "CN-",
  debit_note: "DN-",
  receipt: "R-",
  payment: "PM-",
  journal: "J-",
  job_outward: "JO-",
  job_inward: "JI-",
  mill_outward: "MO-",
  mill_inward: "MI-",
  lot_transfer: "LT-",
};

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!session.user.companyId) {
      return NextResponse.json({ error: "No company selected" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const voucherType = searchParams.get("type");

    if (!voucherType) {
      return NextResponse.json({ error: "Missing voucher type" }, { status: 400 });
    }

    const companyId = Number(session.user.companyId);

    // Fetch or create sequence in a transaction to ensure safety
    const nextVoucherNo = await db.transaction(async (tx) => {
      let seq = await tx.query.mVoucherSequences.findFirst({
        where: and(
          eq(mVoucherSequences.companyId, companyId),
          eq(mVoucherSequences.voucherType, voucherType)
        ),
      });

      if (!seq) {
        const prefix = DEFAULT_PREFIXES[voucherType] || `${voucherType.toUpperCase().substring(0, 3)}-`;
        const [newSeq] = await tx
          .insert(mVoucherSequences)
          .values({
            companyId,
            voucherType,
            prefix,
            nextNumber: 1,
            createdBy: session.user.id,
            updatedBy: session.user.id,
          })
          .returning();
        seq = newSeq;
      }

      return `${seq.prefix}${seq.nextNumber}`;
    });

    return NextResponse.json({ nextVoucherNo });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch next voucher number" },
      { status: 500 }
    );
  }
}
