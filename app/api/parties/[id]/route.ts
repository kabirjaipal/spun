import { db } from "@/lib/db";
import { mCompanies, mLedgers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { id } = await params;
  const parentCompanyId = Number(session.user.companyId);
  const userId = session.user.id;

  const {
    companyName, gstNo, phone, email, address,
    panNo, pincode, state, currencySymbol, nationName,
    bankName, bankAccountName, accountNo, ifscCode, branchName, accountType,
    gstApplicable, gstType, stateCode, city, companyType, marketCategory,
    financialYearStart
  } = await request.json();

  try {
    const [company] = await db.transaction(async (tx) => {
      const oldC = await tx.query.mCompanies.findFirst({
        where: and(eq(mCompanies.companyId, Number(id)), eq(mCompanies.parentCompanyId, parentCompanyId))
      });

      if (!oldC) {
        throw new Error("Party not found or unauthorized");
      }

      const [c] = await tx
        .update(mCompanies)
        .set({
          companyName,
          gstNo,
          phone,
          email,
          address,
          panNo,
          pincode,
          state,
          currencySymbol,
          nationName,
          bankName,
          bankAccountName,
          accountNo,
          ifscCode,
          branchName,
          accountType,
          gstApplicable: gstApplicable !== undefined ? !!gstApplicable : undefined,
          gstType,
          stateCode,
          city,
          companyType,
          marketCategory,
          financialYearStart,
          updatedBy: userId,
          updatedOn: new Date(),
        })
        .where(and(eq(mCompanies.companyId, Number(id)), eq(mCompanies.parentCompanyId, parentCompanyId)))
        .returning();

      if (companyName) {
        await tx
          .update(mLedgers)
          .set({ ledgerName: companyName, updatedBy: userId, updatedOn: new Date() })
          .where(
            and(
              eq(mLedgers.referenceId, Number(id)),
              eq(mLedgers.ledgerType, "company"),
              eq(mLedgers.companyId, parentCompanyId)
            )
          );
      }

      if (c) {
        await writeAuditLog(tx, {
          tableName: "m_companies",
          recordId: Number(id),
          actionType: "update",
          oldDataJson: oldC || null,
          newDataJson: c,
          createdBy: userId,
        });
      }

      return [c];
    });

    return NextResponse.json(company);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update party" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { id } = await params;
  const parentCompanyId = Number(session.user.companyId);
  const userId = session.user.id;
  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      const oldC = await tx.query.mCompanies.findFirst({
        where: and(eq(mCompanies.companyId, Number(id)), eq(mCompanies.parentCompanyId, parentCompanyId))
      });

      if (!oldC) {
        throw new Error("Party not found or unauthorized");
      }

      await tx
        .update(mCompanies)
        .set({ deletedOn: now, deletedBy: userId })
        .where(and(eq(mCompanies.companyId, Number(id)), eq(mCompanies.parentCompanyId, parentCompanyId)));

      await tx
        .update(mLedgers)
        .set({ deletedOn: now, deletedBy: userId })
        .where(
          and(
            eq(mLedgers.referenceId, Number(id)),
            eq(mLedgers.ledgerType, "company"),
            eq(mLedgers.companyId, parentCompanyId)
          )
        );

      await writeAuditLog(tx, {
        tableName: "m_companies",
        recordId: Number(id),
        actionType: "delete",
        oldDataJson: oldC || null,
        newDataJson: { deletedOn: now, deletedBy: userId },
        createdBy: userId,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete party" }, { status: 500 });
  }
}
