import { db } from "@/lib/db";
import { mCompanies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.companyId) {
    return NextResponse.json({ error: "No company associated" }, { status: 400 });
  }

  const companyId = Number(session.user.companyId);
  const userId = session.user.id;
  const body = await request.json();
  const { companyName, gstNo, panNo, address, financialYearStart } = body;

  if (!companyName) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }

  try {
    const [updatedCompany] = await db.transaction(async (tx) => {
      const oldCompany = await tx.query.mCompanies.findFirst({
        where: eq(mCompanies.companyId, companyId),
      });

      const [updated] = await tx
        .update(mCompanies)
        .set({
          companyName,
          gstNo: gstNo ? gstNo.trim().toUpperCase() : null,
          panNo: panNo ? panNo.trim().toUpperCase() : null,
          address: address || null,
          financialYearStart: financialYearStart || null,
          updatedBy: userId,
          updatedOn: new Date(),
        })
        .where(eq(mCompanies.companyId, companyId))
        .returning();

      if (updated) {
        await writeAuditLog(tx, {
          tableName: "m_companies",
          recordId: companyId,
          actionType: "update",
          oldDataJson: oldCompany || null,
          newDataJson: updated,
          createdBy: userId,
        });
      }

      return [updated];
    });

    return NextResponse.json(updatedCompany);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update company settings" },
      { status: 500 }
    );
  }
}
