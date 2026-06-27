import { db } from "@/lib/db";
import { mCompanies, mUsers, mLedgerGroups, mInventoryGroups, mUnitsOfMeasurement } from "@/lib/db/schema";
import { auth } from "@/auth";
import { eq, sql, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      companyName,
      gstNo,
      panNo,
      address,
      financialYearStart,
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
    } = body;

    if (!companyName) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }

    const result = await db.transaction(async (tx) => {
      // Check if a company with the same name already exists (case-insensitive)
      const existingCompany = await tx.query.mCompanies.findFirst({
        where: (companies, { eq, sql }) => eq(sql`lower(${companies.companyName})`, companyName.toLowerCase()),
      });

      if (existingCompany) {
        // Check if there is any user associated with this company
        const existingUser = await tx.query.mUsers.findFirst({
          where: (users, { eq }) => eq(users.companyId, Number(existingCompany.companyId)),
        });

        if (existingUser && existingUser.id !== session.user.id) {
          throw new Error("Company with this name already exists");
        }

        // Reuse the existing company, link user to it
        await tx
          .update(mUsers)
          .set({ 
            companyId: Number(existingCompany.companyId),
            role: "company"
          })
          .where(eq(mUsers.id, session.user.id));

        // Update the company details
        await tx
          .update(mCompanies)
          .set({
            gstNo: gstNo ? gstNo.trim().toUpperCase() : null,
            panNo: panNo ? panNo.trim().toUpperCase() : null,
            address: address || null,
            pincode: pincode || null,
            state: state || null,
            phone: phone || null,
            email: email || null,
            currencySymbol: currencySymbol || null,
            nationName: nationName || null,
            bankName: bankName || null,
            bankAccountName: bankAccountName || null,
            accountNo: accountNo || null,
            ifscCode: ifscCode || null,
            branchName: branchName || null,
            accountType: accountType || null,
            gstApplicable: !!gstApplicable,
            gstType: gstType || null,
            stateCode: stateCode || null,
            city: city || null,
            financialYearStart: financialYearStart || null,
            companyType: companyType || "general",
            marketCategory: marketCategory || null,
            updatedBy: session.user.id,
          })
          .where(eq(mCompanies.companyId, existingCompany.companyId));

        return existingCompany;
      }

      // 1. Create company
      const [newCompany] = await tx
        .insert(mCompanies)
        .values({
          companyName,
          gstNo: gstNo ? gstNo.trim().toUpperCase() : null,
          panNo: panNo ? panNo.trim().toUpperCase() : null,
          address: address || null,
          pincode: pincode || null,
          state: state || null,
          phone: phone || null,
          email: email || null,
          currencySymbol: currencySymbol || null,
          nationName: nationName || null,
          bankName: bankName || null,
          bankAccountName: bankAccountName || null,
          accountNo: accountNo || null,
          ifscCode: ifscCode || null,
          branchName: branchName || null,
          accountType: accountType || null,
          gstApplicable: !!gstApplicable,
          gstType: gstType || null,
          stateCode: stateCode || null,
          city: city || null,
          financialYearStart: financialYearStart || null,
          companyType: companyType || "general",
          marketCategory: marketCategory || null,
          createdBy: session.user.id,
          updatedBy: session.user.id,
        })
        .returning({ companyId: mCompanies.companyId });

      // Seed default ledger groups
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
          companyId: Number(newCompany.companyId),
          groupName,
          isSystem: true,
          createdBy: session.user.id,
          updatedBy: session.user.id,
        }))
      );

      // Seed default inventory groups
      const defaultInvGroups = ["Consumable", "Selling"];
      await tx.insert(mInventoryGroups).values(
        defaultInvGroups.map((groupName) => ({
          companyId: Number(newCompany.companyId),
          groupName,
          createdBy: session.user.id,
          updatedBy: session.user.id,
        }))
      );

      // Seed default units of measurement
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
          companyId: Number(newCompany.companyId),
          unitCode: u.code,
          unitName: u.name,
          isFixed: true,
          createdBy: session.user.id,
          updatedBy: session.user.id,
        }))
      );

      // 2. Associate user with company and assign role
      await tx
        .update(mUsers)
        .set({ 
          companyId: Number(newCompany.companyId),
          role: "company"
        })
        .where(eq(mUsers.id, session.user.id));

      return newCompany;
    });

    return NextResponse.json({
      message: "Company set up successfully",
      companyId: result.companyId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to set up company" },
      { status: 500 }
    );
  }
}
