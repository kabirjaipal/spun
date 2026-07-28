import { db } from "@/lib/db";
import { mCompanies, mLedgerGroups, mInventoryGroups, mUnitsOfMeasurement } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { DEFAULT_UNITS, DEFAULT_LEDGER_GROUPS, DEFAULT_INVENTORY_GROUPS } from "@/lib/constants";

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
  const {
    companyName,
    gstNo,
    panNo,
    address,
    financialYearStart,
    companyType,
    marketCategory,
    bankName,
    bankAccountName,
    accountNo,
    ifscCode,
    branchName,
    accountType,
    msmeRegistered,
    msmeType,
    msmeNo,
    phone,
    email,
    pincode,
    state,
    stateCode,
    city,
    nationName,
    currencySymbol,
    gstApplicable,
    gstType,
  } = body;

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
          companyType: companyType || "general",
          marketCategory: marketCategory || null,
          bankName: bankName || null,
          bankAccountName: bankAccountName || null,
          accountNo: accountNo || null,
          ifscCode: ifscCode || null,
          branchName: branchName || null,
          accountType: accountType || null,
          msmeRegistered: !!msmeRegistered,
          msmeType: msmeRegistered ? (msmeType || null) : null,
          msmeNo: msmeRegistered ? (msmeNo || null) : null,
          phone: phone || null,
          email: email || null,
          pincode: pincode || null,
          state: state || null,
          stateCode: stateCode || null,
          city: city || null,
          nationName: nationName || null,
          currencySymbol: currencySymbol || null,
          gstApplicable: !!gstApplicable,
          gstType: gstType || null,
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

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json();
  const {
    companyName,
    gstNo,
    panNo,
    address,
    financialYearStart,
    companyType,
    marketCategory,
    bankName,
    bankAccountName,
    accountNo,
    ifscCode,
    branchName,
    accountType,
    msmeRegistered,
    msmeType,
    msmeNo,
    phone,
    email,
    pincode,
    state,
    stateCode,
    city,
    nationName,
    currencySymbol,
    gstApplicable,
    gstType,
  } = body;

  if (!companyName) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Check if company name already exists
      const existingCompany = await tx.query.mCompanies.findFirst({
        where: (companies, { eq, sql }) =>
          eq(sql`lower(${companies.companyName})`, companyName.toLowerCase()),
      });

      if (existingCompany) {
        throw new Error("Company with this name already exists");
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
          jobPartyType: "trader",
          msmeRegistered: !!msmeRegistered,
          msmeType: msmeRegistered ? (msmeType || null) : null,
          msmeNo: msmeRegistered ? (msmeNo || null) : null,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      const insertedCompanyId = Number(newCompany.companyId);

      await tx.insert(mLedgerGroups).values(
        DEFAULT_LEDGER_GROUPS.map((groupName) => ({
          companyId: insertedCompanyId,
          groupName,
          isSystem: true,
          createdBy: userId,
          updatedBy: userId,
        }))
      );

      // Seed default inventory groups
      await tx.insert(mInventoryGroups).values(
        DEFAULT_INVENTORY_GROUPS.map((groupName) => ({
          companyId: insertedCompanyId,
          groupName,
          createdBy: userId,
          updatedBy: userId,
        }))
      );

      // Seed default units of measurement
      await tx.insert(mUnitsOfMeasurement).values(
        DEFAULT_UNITS.map((u) => ({
          companyId: insertedCompanyId,
          unitCode: u.code,
          unitName: u.name,
          isFixed: true,
          createdBy: userId,
          updatedBy: userId,
        }))
      );

      await writeAuditLog(tx, {
        tableName: "m_companies",
        recordId: insertedCompanyId,
        actionType: "create",
        oldDataJson: null,
        newDataJson: newCompany,
        createdBy: userId,
      });

      return newCompany;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create new company" },
      { status: 500 }
    );
  }
}
