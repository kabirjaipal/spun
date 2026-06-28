import { db } from "@/lib/db";
import { mCompanies, mLedgers, mLedgerGroups, mInventoryGroups, mUnitsOfMeasurement } from "@/lib/db/schema";
import { and, isNull, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const companyId = Number(session.user.companyId);

  const rows = await db
    .select()
    .from(mCompanies)
    .where(and(eq(mCompanies.parentCompanyId, companyId), isNull(mCompanies.deletedOn)))
    .orderBy(mCompanies.companyName);

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const parentCompanyId = Number(session.user.companyId);
  const userId = session.user.id;

  const body = await request.json();
  const {
    companyName,
    gstNo,
    panNo,
    address,
    pincode,
    state,
    phone,
    email,
    currencySymbol,
    nationName,
    bankName,
    bankAccountName,
    accountNo,
    ifscCode,
    branchName,
    accountType,
    gstApplicable,
    gstType,
    stateCode,
    city,
    companyType,
    marketCategory,
    financialYearStart,
  } = body;

  if (!companyName) {
    return NextResponse.json({ error: "companyName is required" }, { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Check if a sub-company with same name already exists under this parent
      const existingCompany = await tx.query.mCompanies.findFirst({
        where: and(
          eq(mCompanies.parentCompanyId, parentCompanyId),
          eq(mCompanies.companyName, companyName),
          isNull(mCompanies.deletedOn)
        ),
      });

      if (existingCompany) {
        throw new Error("Sub-company with this name already exists");
      }

      const currentYear = new Date().getFullYear();
      const defaultFyStart = `${currentYear}-04-01`;

      // 2. Create the company record
      const [newCompany] = await tx
        .insert(mCompanies)
        .values({
          parentCompanyId,
          companyName,
          gstNo: gstNo ? gstNo.trim().toUpperCase() : null,
          panNo: panNo ? panNo.trim().toUpperCase() : null,
          address: address || null,
          pincode: pincode || null,
          state: state || null,
          phone: phone || null,
          email: email || null,
          currencySymbol: currencySymbol || "₹",
          nationName: nationName || "India",
          bankName: bankName || null,
          bankAccountName: bankAccountName || null,
          accountNo: accountNo || null,
          ifscCode: ifscCode || null,
          branchName: branchName || null,
          accountType: accountType || "current",
          gstApplicable: !!gstApplicable,
          gstType: gstType || "regular",
          stateCode: stateCode || null,
          city: city || null,
          financialYearStart: financialYearStart || defaultFyStart,
          companyType: companyType || "general",
          marketCategory: marketCategory || "Retail",
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      const newCompanyId = Number(newCompany.companyId);

      // 3. Seed default ledger groups for the new sub-company
      const defaultGroups = [
        "Capital Account",
        "Sales Account",
        "Purchase Account",
        "Bank Account",
        "Stock in Hand",
        "Sales Return",
        "Purchase Return",
        "Direct Expenses",
        "Indirect Income",
        "Profit & Loss",
        "Unsecured Loans",
        "Secured Loans",
        "Deposits & Advance Assets",
        "Fixed Assets",
        "Investment",
        "Loan (Assets)",
        "Preliminary Expenses",
        "Cash in Hand",
        "Provisions",
        "Sundry Debtors",
        "Sundry Creditors",
        "Suspense Account"
      ];
      await tx.insert(mLedgerGroups).values(
        defaultGroups.map((groupName) => ({
          companyId: newCompanyId,
          groupName,
          isSystem: true,
          createdBy: userId,
          updatedBy: userId,
        }))
      );

      // 4. Seed default inventory groups for the new sub-company
      const defaultInvGroups = ["Consumable", "Selling"];
      await tx.insert(mInventoryGroups).values(
        defaultInvGroups.map((groupName) => ({
          companyId: newCompanyId,
          groupName,
          createdBy: userId,
          updatedBy: userId,
        }))
      );

      // 5. Seed default units of measurement for the new sub-company
      const defaultUnits = [
        { code: "PCS", name: "Pieces" },
        { code: "MTR", name: "Meters" },
        { code: "KGS", name: "Kilograms" },
        { code: "GRM", name: "Grams" },
        { code: "LTR", name: "Liters" },
        { code: "BOX", name: "BOX" },
      ];
      await tx.insert(mUnitsOfMeasurement).values(
        defaultUnits.map((u) => ({
          companyId: newCompanyId,
          unitCode: u.code,
          unitName: u.name,
          isFixed: true,
          createdBy: userId,
          updatedBy: userId,
        }))
      );

      // 6. Create ledger entry in parent company pointing to this sub-company
      await tx.insert(mLedgers).values({
        companyId: parentCompanyId,
        ledgerName: companyName,
        ledgerType: "company",
        referenceId: newCompanyId,
        createdBy: userId,
        updatedBy: userId,
      });

      // 7. Write audit log
      await writeAuditLog(tx, {
        tableName: "m_companies",
        recordId: newCompanyId,
        actionType: "create",
        newDataJson: newCompany,
        createdBy: userId,
      });

      return newCompany;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create company" }, { status: 500 });
  }
}
