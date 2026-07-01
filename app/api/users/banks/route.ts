import { db } from "@/lib/db";
import { mCompanies } from "@/lib/db/schema";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch all distinct banks and branches used in this user's companies
    const rows = await db
      .select({
        bankName: mCompanies.bankName,
        branchName: mCompanies.branchName,
        ifscCode: mCompanies.ifscCode,
      })
      .from(mCompanies)
      .where(
        and(
          eq(mCompanies.createdBy, userId),
          isNotNull(mCompanies.bankName),
          isNotNull(mCompanies.branchName),
          isNotNull(mCompanies.ifscCode),
          isNull(mCompanies.deletedOn)
        )
      );

    const uniqueBanks: { bankName: string; branches: { branchName: string; ifscCode: string }[] }[] = [];

    for (const row of rows) {
      const bName = row.bankName!.trim();
      const brName = row.branchName!.trim();
      const ifsc = row.ifscCode!.trim().toUpperCase();

      if (!bName || !brName || !ifsc) continue;

      let bank = uniqueBanks.find((b) => b.bankName.toLowerCase() === bName.toLowerCase());
      if (!bank) {
        bank = { bankName: bName, branches: [] };
        uniqueBanks.push(bank);
      }

      if (!bank.branches.some((br) => br.ifscCode === ifsc)) {
        bank.branches.push({ branchName: brName, ifscCode: ifsc });
      }
    }

    return NextResponse.json(uniqueBanks);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch user banks" },
      { status: 500 }
    );
  }
}
