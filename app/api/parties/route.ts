import { db } from "@/lib/db";
import { mCompanies, mLedgers, mLedgerGroups, mInventoryGroups, mUnitsOfMeasurement, tVouchers } from "@/lib/db/schema";
import { and, isNull, eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { DEFAULT_UNITS, DEFAULT_LEDGER_GROUPS, DEFAULT_INVENTORY_GROUPS } from "@/lib/constants";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const companyId = Number(session.user.companyId);

  const rows = await db
    .select({
      companyId: mCompanies.companyId,
      parentCompanyId: mCompanies.parentCompanyId,
      companyName: mCompanies.companyName,
      gstNo: mCompanies.gstNo,
      panNo: mCompanies.panNo,
      address: mCompanies.address,
      pincode: mCompanies.pincode,
      state: mCompanies.state,
      phone: mCompanies.phone,
      email: mCompanies.email,
      currencySymbol: mCompanies.currencySymbol,
      nationName: mCompanies.nationName,
      bankName: mCompanies.bankName,
      bankAccountName: mCompanies.bankAccountName,
      accountNo: mCompanies.accountNo,
      ifscCode: mCompanies.ifscCode,
      branchName: mCompanies.branchName,
      accountType: mCompanies.accountType,
      gstApplicable: mCompanies.gstApplicable,
      gstType: mCompanies.gstType,
      stateCode: mCompanies.stateCode,
      city: mCompanies.city,
      financialYearStart: mCompanies.financialYearStart,
      companyType: mCompanies.companyType,
      marketCategory: mCompanies.marketCategory,
      msmeRegistered: mCompanies.msmeRegistered,
      msmeType: mCompanies.msmeType,
      msmeNo: mCompanies.msmeNo,
      dueDay: mCompanies.dueDay,
      groupId: mLedgers.groupId,
      ledgerId: mLedgers.ledgerId,
    })
    .from(mCompanies)
    .leftJoin(
      mLedgers,
      and(
        eq(mLedgers.referenceId, mCompanies.companyId),
        eq(mLedgers.ledgerType, "company"),
        isNull(mLedgers.deletedOn)
      )
    )
    .where(and(eq(mCompanies.parentCompanyId, companyId), isNull(mCompanies.deletedOn)))
    .orderBy(desc(mCompanies.createdOn));

  if (rows.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch vouchers to compute pending days dynamically
  const vouchers = await db.query.tVouchers.findMany({
    where: and(
      eq(tVouchers.companyId, companyId),
      isNull(tVouchers.deletedOn)
    ),
  });

  const invoices: typeof vouchers = [];
  const adjustments: typeof vouchers = [];
  for (const v of vouchers) {
    if (v.voucherType === "sale" || v.voucherType === "purchase") {
      invoices.push(v);
    } else if (v.voucherType === "payment" || v.voucherType === "receipt" || v.voucherType === "credit_note" || v.voucherType === "debit_note" || v.voucherType === "purchase_return") {
      adjustments.push(v);
    }
  }

  const paidAmounts: Record<number, number> = {};
  for (const adj of adjustments) {
    if (adj.remarks?.includes("[RETURN CHEQUE REVERSAL]")) {
      continue;
    }
    if (adj.billDetails && Array.isArray(adj.billDetails)) {
      for (const item of adj.billDetails) {
        if (item && typeof item === "object" && "voucherId" in item) {
          const vId = Number(item.voucherId);
          const amt = Number(item.amount) || 0;
          paidAmounts[vId] = (paidAmounts[vId] || 0) + amt;
        }
      }
    }
  }

  const maxOverdueDaysMap: Record<number, number> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const inv of invoices) {
    const netAmt = Number(inv.netAmount) || 0;
    const paidAmt = paidAmounts[Number(inv.voucherId)] || 0;
    const outstanding = netAmt - paidAmt;
    if (outstanding > 0.01) {
      const partyId = Number(inv.partyId);
      if (!partyId) continue;
      
      const invDate = new Date(inv.voucherDate);
      invDate.setHours(0, 0, 0, 0);
      const daysSinceInvoice = Math.floor((today.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
      
      const party = rows.find((r) => r.companyId === partyId);
      const dueDay = party ? party.dueDay : 10;
      
      if (daysSinceInvoice > dueDay) {
        const overdueDays = daysSinceInvoice - dueDay;
        maxOverdueDaysMap[partyId] = Math.max(maxOverdueDaysMap[partyId] || 0, overdueDays);
      }
    }
  }

  const rowsWithPending = rows.map((party) => ({
    ...party,
    pendingDueDay: maxOverdueDaysMap[party.companyId] || 0,
  }));

  return NextResponse.json(rowsWithPending);
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
    msmeRegistered,
    msmeType,
    msmeNo,
    dueDay,
    groupId,
  } = body;

  if (!companyName) {
    return NextResponse.json({ error: "companyName is required" }, { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Check if a sub-company/party with same name already exists under this parent
      const existingCompany = await tx.query.mCompanies.findFirst({
        where: and(
          eq(mCompanies.parentCompanyId, parentCompanyId),
          eq(mCompanies.companyName, companyName),
          isNull(mCompanies.deletedOn)
        ),
      });

      if (existingCompany) {
        throw new Error("Party with this name already exists");
      }

      const currentYear = new Date().getFullYear();
      const defaultFyStart = `${currentYear}-04-01`;

      // 2. Create the company/party record
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
          msmeRegistered: !!msmeRegistered,
          msmeType: msmeRegistered ? (msmeType || null) : null,
          msmeNo: msmeRegistered ? (msmeNo || null) : null,
          dueDay: dueDay !== undefined ? Number(dueDay) : 10,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      const newCompanyId = Number(newCompany.companyId);

      // 3. Seed default ledger groups for the new sub-company/party
      await tx.insert(mLedgerGroups).values(
        DEFAULT_LEDGER_GROUPS.map((groupName) => ({
          companyId: newCompanyId,
          groupName,
          isSystem: true,
          createdBy: userId,
          updatedBy: userId,
        }))
      );

      // 4. Seed default inventory groups for the new sub-company/party
      await tx.insert(mInventoryGroups).values(
        DEFAULT_INVENTORY_GROUPS.map((groupName) => ({
          companyId: newCompanyId,
          groupName,
          createdBy: userId,
          updatedBy: userId,
        }))
      );

      // 5. Seed default units of measurement for the new sub-company/party
      await tx.insert(mUnitsOfMeasurement).values(
        DEFAULT_UNITS.map((u) => ({
          companyId: newCompanyId,
          unitCode: u.code,
          unitName: u.name,
          isFixed: true,
          createdBy: userId,
          updatedBy: userId,
        }))
      );

      // 6. Create ledger entry in parent company pointing to this sub-company/party
      let resolvedLedgerType = "company";
      if (groupId) {
        const grp = await tx.query.mLedgerGroups.findFirst({
          where: eq(mLedgerGroups.groupId, Number(groupId)),
        });
        if (grp && (grp.groupName.toLowerCase().includes("debtor") || grp.groupName.toLowerCase().includes("customer"))) {
          resolvedLedgerType = "customer";
        }
      }

      const [newL] = await tx.insert(mLedgers).values({
        companyId: parentCompanyId,
        ledgerName: companyName,
        ledgerType: resolvedLedgerType,
        referenceId: newCompanyId,
        groupId: groupId ? Number(groupId) : null,
        createdBy: userId,
        updatedBy: userId,
      }).returning();

      // 7. Write audit log
      await writeAuditLog(tx, {
        tableName: "m_companies",
        recordId: newCompanyId,
        actionType: "create",
        newDataJson: newCompany,
        createdBy: userId,
      });

      return { ...newCompany, ledgerId: newL.ledgerId, groupId: newL.groupId };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create party" }, { status: 500 });
  }
}
