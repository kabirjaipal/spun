import { db } from "@/lib/db";
import { mTaxRates } from "@/lib/db/schema";
import { isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(mTaxRates)
    .where(isNull(mTaxRates.deletedOn))
    .orderBy(mTaxRates.taxPercent);

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taxName, taxPercent } = await request.json();
  if (!taxName || taxPercent == null) {
    return NextResponse.json({ error: "taxName and taxPercent are required" }, { status: 400 });
  }

  const [row] = await db
    .insert(mTaxRates)
    .values({ taxName, taxPercent: String(taxPercent), createdBy: session.user.id, updatedBy: session.user.id })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
