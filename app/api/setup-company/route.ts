import { db } from "@/lib/db";
import {
  mCompanies,
  mUsers,
  mLedgerGroups,
  mInventoryGroups,
  mUnitsOfMeasurement,
  mLedgers,
} from "@/lib/db/schema";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { DEFAULT_UNITS, DEFAULT_LEDGER_GROUPS, DEFAULT_INVENTORY_GROUPS } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Support both an array of companies or a single company object
    const companiesList = body.companies || [body];

    if (!companiesList.length) {
      return NextResponse.json(
        { error: "At least one company details are required" },
        { status: 400 }
      );
    }

    const result = await db.transaction(async (tx) => {
      let rootCompanyId: number | null = null;

      for (let i = 0; i < companiesList.length; i++) {
        const comp = companiesList[i];
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
          msmeRegistered,
          msmeType,
          msmeNo,
        } = comp;

        if (!companyName) {
          throw new Error("Company name is required for all companies");
        }

        // For the first company (root), check if it already exists to allow update
        if (i === 0) {
          const existingCompany = await tx.query.mCompanies.findFirst({
            where: (companies, { eq, sql }) =>
              eq(sql`lower(${companies.companyName})`, companyName.toLowerCase()),
          });

          if (existingCompany) {
            // Check if there is any user associated with this company
            const existingUser = await tx.query.mUsers.findFirst({
              where: (users, { eq }) =>
                eq(users.companyId, Number(existingCompany.companyId)),
            });

            if (existingUser && existingUser.id !== session.user.id) {
              throw new Error("Company with this name already exists");
            }

            // Reuse the existing company
            rootCompanyId = Number(existingCompany.companyId);

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
                msmeRegistered: !!msmeRegistered,
                msmeType: msmeRegistered ? (msmeType || null) : null,
                msmeNo: msmeRegistered ? (msmeNo || null) : null,
                updatedBy: session.user.id,
              })
              .where(eq(mCompanies.companyId, existingCompany.companyId));
            
            continue; // Skip inserting this as a new company
          }
        }

        // Insert new company
        const [newCompany] = await tx
          .insert(mCompanies)
          .values({
            parentCompanyId: null,
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
            msmeRegistered: !!msmeRegistered,
            msmeType: msmeRegistered ? (msmeType || null) : null,
            msmeNo: msmeRegistered ? (msmeNo || null) : null,
            createdBy: session.user.id,
            updatedBy: session.user.id,
          })
          .returning({ companyId: mCompanies.companyId });

        const insertedCompanyId = Number(newCompany.companyId);

        if (i === 0) {
          rootCompanyId = insertedCompanyId;
        }

        // Seed default ledger groups
        await tx.insert(mLedgerGroups).values(
          DEFAULT_LEDGER_GROUPS.map((groupName) => ({
            companyId: insertedCompanyId,
            groupName,
            isSystem: true,
            createdBy: session.user.id,
            updatedBy: session.user.id,
          }))
        );

        // Seed default inventory groups
        await tx.insert(mInventoryGroups).values(
          DEFAULT_INVENTORY_GROUPS.map((groupName) => ({
            companyId: insertedCompanyId,
            groupName,
            createdBy: session.user.id,
            updatedBy: session.user.id,
          }))
        );

        // Seed default units of measurement
        await tx.insert(mUnitsOfMeasurement).values(
          DEFAULT_UNITS.map((u) => ({
            companyId: insertedCompanyId,
            unitCode: u.code,
            unitName: u.name,
            isFixed: true,
            createdBy: session.user.id,
            updatedBy: session.user.id,
          }))
        );
      }

      // Associate user with root company
      await tx
        .update(mUsers)
        .set({
          companyId: rootCompanyId!,
          role: "company",
        })
        .where(eq(mUsers.id, session.user.id));

      return { companyId: rootCompanyId! };
    });

    return NextResponse.json({
      message: "Companies set up successfully",
      companyId: result.companyId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to set up companies" },
      { status: 500 }
    );
  }
}
