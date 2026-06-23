import { db } from "@/lib/db";
import { mTaxRates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { taxName, taxPercent } = await request.json();

  const [row] = await db
    .update(mTaxRates)
    .set({ taxName, taxPercent: String(taxPercent), updatedBy: session.user.id, updatedOn: new Date() })
    .where(eq(mTaxRates.taxRateId, Number(id)))
    .returning();

  return NextResponse.json(row);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await db
    .update(mTaxRates)
    .set({ deletedOn: new Date(), deletedBy: session.user.id })
    .where(eq(mTaxRates.taxRateId, Number(id)));

  return NextResponse.json({ success: true });
}
