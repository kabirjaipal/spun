import { db } from "./index";
import {
  mCompanies,
  mUsers,
  mTaxRates,
  mInventoryGroups,
  mInventoryCategories,
  mUnitsOfMeasurement,
  mInventory,
  mJobs,
  mMills,
  mLedgerGroups,
  mLedgers,
  tVouchers,
  tVoucherItems,
  tVoucherEntries,
  tStockMovements,
} from "./schema";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";

export async function seedRealData() {
  console.log("Seeding database with realistic textile company data...");

  // 1. Password hashing for user test@texora.com
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash("password123", salt);

  await db.transaction(async (tx) => {
    // 1.5. Cleanup existing test user and associated company data
    const existingUser = await tx.query.mUsers.findFirst({
      where: eq(mUsers.email, "test@texora.com"),
    });

    if (existingUser) {
      console.log("Found existing test@texora.com user. Cleaning up old seed data...");
      const testCompanyId = existingUser.companyId;

      // 1. Delete the user record first to resolve foreign key constraints
      await tx.delete(mUsers).where(eq(mUsers.id, existingUser.id));

      if (testCompanyId) {
        const parentId = Number(testCompanyId);

        // Find all sub-companies
        const subComps = await tx.query.mCompanies.findMany({
          where: eq(mCompanies.parentCompanyId, parentId),
        });
        const companyIds = [parentId, ...subComps.map((c) => Number(c.companyId))];

        console.log(`Deleting transactions for companies: ${companyIds.join(", ")}`);

        // A. Delete stock movements
        await tx.delete(tStockMovements).where(inArray(tStockMovements.companyId, companyIds));

        // B. Delete voucher items and entries
        const dbVouchers = await tx.query.tVouchers.findMany({
          where: inArray(tVouchers.companyId, companyIds),
          columns: { voucherId: true },
        });
        const vIds = dbVouchers.map((v) => Number(v.voucherId));

        if (vIds.length > 0) {
          await tx.delete(tVoucherItems).where(inArray(tVoucherItems.voucherId, vIds));
          await tx.delete(tVoucherEntries).where(inArray(tVoucherEntries.voucherId, vIds));
          await tx.delete(tVouchers).where(inArray(tVouchers.voucherId, vIds));
        }

        // C. Delete ledgers
        await tx.delete(mLedgers).where(inArray(mLedgers.companyId, companyIds));

        // D. Delete ledger groups
        await tx.delete(mLedgerGroups).where(inArray(mLedgerGroups.companyId, companyIds));

        // E. Delete inventory
        await tx.delete(mInventory).where(inArray(mInventory.companyId, companyIds));

        // F. Delete inventory groups & categories
        await tx.delete(mInventoryGroups).where(inArray(mInventoryGroups.companyId, companyIds));
        await tx.delete(mInventoryCategories).where(inArray(mInventoryCategories.companyId, companyIds));

        // G. Delete units of measurement
        await tx.delete(mUnitsOfMeasurement).where(inArray(mUnitsOfMeasurement.companyId, companyIds));

        // H. Delete jobs & mills
        await tx.delete(mJobs).where(inArray(mJobs.companyId, companyIds));
        await tx.delete(mMills).where(inArray(mMills.companyId, companyIds));

        // I. Delete companies (sub-companies first to respect FK)
        if (subComps.length > 0) {
          await tx.delete(mCompanies).where(inArray(mCompanies.companyId, subComps.map(c => Number(c.companyId))));
        }
        await tx.delete(mCompanies).where(eq(mCompanies.companyId, parentId));
      }
      console.log("Cleanup of test@texora.com data completed.");
    } else {
      console.log("not found test@texora.com user.")
    }

    // 2. Tax Rates
    console.log("Setting up tax rates...");
    const getOrCreateTaxRate = async (name: string, percent: string) => {
      let rate = await tx.query.mTaxRates.findFirst({
        where: eq(mTaxRates.taxName, name),
      });
      if (!rate) {
        const [inserted] = await tx.insert(mTaxRates).values({ taxName: name, taxPercent: percent }).returning();
        rate = inserted;
      }
      return rate;
    };

    const tax5 = await getOrCreateTaxRate("GST 5%", "5.00");
    const tax12 = await getOrCreateTaxRate("GST 12%", "12.00");
    const tax18 = await getOrCreateTaxRate("GST 18%", "18.00");
    const tax28 = await getOrCreateTaxRate("GST 28%", "28.00");
    const tax0 = await getOrCreateTaxRate("GST 0%", "0.00");

    // 3. Primary Company
    console.log("Inserting primary company...");
    const [company] = await tx.insert(mCompanies).values({
      companyName: "Texora Trading Co.",
      gstNo: "24AAAAB1234C1Z1",
      panNo: "AAAAB1234C",
      address: "102-105, Ring Road Textile Market",
      pincode: "395002",
      state: "Gujarat",
      phone: "+91 98765 43210",
      email: "info@texoratrading.com",
      currencySymbol: "₹",
      nationName: "India",
      bankName: "State Bank of India",
      bankAccountName: "Texora Trading Co.",
      accountNo: "34567890123",
      ifscCode: "SBIN0001234",
      branchName: "Ring Road Branch",
      accountType: "current",
      gstApplicable: true,
      gstType: "regular",
      stateCode: "24",
      city: "Surat",
      financialYearStart: "2026-04-01",
      companyType: "textiles",
      marketCategory: "Trading",
    }).returning();
    const companyId = Number(company.companyId);

    // 4. Seeding user test@texora.com linked to this company
    console.log("Inserting test user...");
    const [user] = await tx.insert(mUsers).values({
      name: "Test User",
      email: "test@texora.com",
      passwordHash,
      role: "company",
      companyId: companyId,
      isActive: true,
    }).returning();
    const userId = user.id;

    // 5. Ledger Groups
    console.log("Inserting ledger groups...");
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
    const insertedGroups = await tx.insert(mLedgerGroups).values(
      defaultGroups.map((groupName) => ({
        companyId,
        groupName,
        isSystem: true,
        createdBy: userId,
        updatedBy: userId,
      }))
    ).returning();

    const groupMap = new Map(insertedGroups.map(g => [g.groupName, Number(g.groupId)]));

    // 6. Inventory Groups
    console.log("Inserting inventory groups...");
    const [groupSelling] = await tx.insert(mInventoryGroups).values({
      companyId,
      groupName: "Selling",
      createdBy: userId,
      updatedBy: userId,
    }).returning();
    const [groupConsumable] = await tx.insert(mInventoryGroups).values({
      companyId,
      groupName: "Consumable",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    // 7. Inventory Categories
    console.log("Inserting inventory categories...");
    const [catGrey] = await tx.insert(mInventoryCategories).values({
      companyId,
      categoryName: "Grey Fabric",
      createdBy: userId,
      updatedBy: userId,
    }).returning();
    const [catFinished] = await tx.insert(mInventoryCategories).values({
      companyId,
      categoryName: "Finished Fabric",
      createdBy: userId,
      updatedBy: userId,
    }).returning();
    const [catChemical] = await tx.insert(mInventoryCategories).values({
      companyId,
      categoryName: "Dyes & Chemicals",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    // 8. Units of Measurement
    console.log("Inserting units...");
    const [unitMtr] = await tx.insert(mUnitsOfMeasurement).values({
      companyId,
      unitCode: "MTR",
      unitName: "Meters",
      isFixed: true,
      createdBy: userId,
      updatedBy: userId,
    }).returning();
    const [unitPcs] = await tx.insert(mUnitsOfMeasurement).values({
      companyId,
      unitCode: "PCS",
      unitName: "Pieces",
      isFixed: true,
      createdBy: userId,
      updatedBy: userId,
    }).returning();
    const [unitKgs] = await tx.insert(mUnitsOfMeasurement).values({
      companyId,
      unitCode: "KGS",
      unitName: "Kilograms",
      isFixed: true,
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    // 9. Inventory Items
    console.log("Inserting inventory items...");
    const [invCottonGrey] = await tx.insert(mInventory).values({
      companyId,
      inventoryCode: "COTTON-GREY",
      inventoryName: "Cotton Grey 40/40",
      unit: "MTR",
      gstRateId: Number(tax5.taxRateId),
      openingStockQty: "5000.0000",
      openingStockRate: "45.00",
      hsnCode: "5208",
      inventoryGroupId: Number(groupSelling.inventoryGroupId),
      inventoryCategoryId: Number(catGrey.inventoryCategoryId),
      gstType: "center",
      gstPercent: "5.00",
      isConsumable: false,
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    const [invPolySatin] = await tx.insert(mInventory).values({
      companyId,
      inventoryCode: "POLY-SATIN",
      inventoryName: "Polyester Finished Satin",
      unit: "MTR",
      gstRateId: Number(tax12.taxRateId),
      openingStockQty: "2500.0000",
      openingStockRate: "85.00",
      hsnCode: "5407",
      inventoryGroupId: Number(groupSelling.inventoryGroupId),
      inventoryCategoryId: Number(catFinished.inventoryCategoryId),
      gstType: "center",
      gstPercent: "12.00",
      isConsumable: false,
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    const [invDyesBlack] = await tx.insert(mInventory).values({
      companyId,
      inventoryCode: "DYES-BLACK",
      inventoryName: "Dyes Black-B",
      unit: "KGS",
      gstRateId: Number(tax18.taxRateId),
      openingStockQty: "100.0000",
      openingStockRate: "250.00",
      hsnCode: "3204",
      inventoryGroupId: Number(groupConsumable.inventoryGroupId),
      inventoryCategoryId: Number(catChemical.inventoryCategoryId),
      gstType: "center",
      gstPercent: "18.00",
      isConsumable: true,
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    // 10. Jobs
    console.log("Inserting jobs...");
    const [jobAmbika] = await tx.insert(mJobs).values({
      companyId,
      jobName: "Ambika Dyeing & Printing",
      address: "Plot 12, GIDC, Sachin",
      gstNo: "24AAAPA1111A1Z1",
      gstType: "regular",
      city: "Surat",
      stateCode: "24",
      phone: "9825112345",
      msmeRegistered: true,
      msmeType: "micro",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    const [jobBalaji] = await tx.insert(mJobs).values({
      companyId,
      jobName: "Balaji Weaving Mills",
      address: "Bhestan Road, Surat",
      gstNo: "24AAAPB2222B1Z2",
      gstType: "regular",
      city: "Surat",
      stateCode: "24",
      phone: "9825154321",
      msmeRegistered: false,
      msmeType: "non_registered",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    // 11. Mills
    console.log("Inserting mills...");
    const [millKrishna] = await tx.insert(mMills).values({
      companyId,
      millName: "Krishna Processors",
      address: "Narol GIDC, Ahmedabad",
      gstNo: "24AAAPC3333C1Z3",
      gstType: "regular",
      city: "Ahmedabad",
      stateCode: "24",
      phone: "9924012345",
      msmeRegistered: true,
      msmeType: "small",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    const [millRadhe] = await tx.insert(mMills).values({
      companyId,
      millName: "Radhe Textiles Mill",
      address: "Jetpur Road, Jetpur",
      gstNo: "24AAAPD4444D1Z4",
      gstType: "regular",
      city: "Jetpur",
      stateCode: "24",
      phone: "9924054321",
      msmeRegistered: false,
      msmeType: "non_registered",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    // 12. Parties (formerly Customers)
    console.log("Inserting parties...");
    const [custRamesh] = await tx.insert(mCompanies).values({
      parentCompanyId: companyId,
      companyName: "Ramesh Fabric Traders",
      gstNo: "24AAACR1234D1Z2",
      phone: "9898012345",
      email: "ramesh@fabrictraders.com",
      address: "A-501, Radhe Textile Market, Ring Road, Surat",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    const [custShreeji] = await tx.insert(mCompanies).values({
      parentCompanyId: companyId,
      companyName: "Shreeji Outfits",
      gstNo: "27AAACS4321E1Z3",
      phone: "9898054321",
      email: "shreeji@outfits.com",
      address: "55, Fashion Plaza, Dadar, Mumbai",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    // 13. Sub-companies (Suppliers)
    console.log("Inserting suppliers...");
    const [supplierGanesh] = await tx.insert(mCompanies).values({
      parentCompanyId: companyId,
      companyName: "Ganesh Yarn Suppliers",
      gstNo: "24AAAAG1111F1Z8",
      panNo: "AAAAG1111F",
      address: "GIDC, Pandesara, Surat",
      pincode: "394221",
      state: "Gujarat",
      phone: "9879012345",
      email: "ganesh@yarnsuppliers.com",
      currencySymbol: "₹",
      nationName: "India",
      gstApplicable: true,
      gstType: "regular",
      stateCode: "24",
      city: "Surat",
      financialYearStart: "2026-04-01",
      companyType: "general",
      marketCategory: "Wholesale",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    const [supplierApex] = await tx.insert(mCompanies).values({
      parentCompanyId: companyId,
      companyName: "Apex Weaving Factory",
      gstNo: "24AAAAA2222G1Z9",
      panNo: "AAAAA2222G",
      address: "Industrial Zone, Kim, Surat",
      pincode: "394110",
      state: "Gujarat",
      phone: "9879054321",
      email: "apex@weavingfactory.com",
      currencySymbol: "₹",
      nationName: "India",
      gstApplicable: true,
      gstType: "regular",
      stateCode: "24",
      city: "Surat",
      financialYearStart: "2026-04-01",
      companyType: "general",
      marketCategory: "Manufacturing",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    // 14. Ledgers
    console.log("Inserting ledgers...");
    const [ledgerCash] = await tx.insert(mLedgers).values({
      companyId,
      ledgerName: "Cash Account",
      groupId: groupMap.get("Cash in Hand"),
      ledgerType: "cash",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    const [ledgerSBI] = await tx.insert(mLedgers).values({
      companyId,
      ledgerName: "State Bank of India A/c",
      groupId: groupMap.get("Bank Account"),
      ledgerType: "bank",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    const [ledgerCapital] = await tx.insert(mLedgers).values({
      companyId,
      ledgerName: "Owner Capital A/c",
      groupId: groupMap.get("Capital Account"),
      ledgerType: "general",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    const [ledgerSales] = await tx.insert(mLedgers).values({
      companyId,
      ledgerName: "Sales A/c",
      groupId: groupMap.get("Sales Account"),
      ledgerType: "general",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    const [ledgerPurchase] = await tx.insert(mLedgers).values({
      companyId,
      ledgerName: "Purchase A/c",
      groupId: groupMap.get("Purchase Account"),
      ledgerType: "general",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    const [ledgerJobWork] = await tx.insert(mLedgers).values({
      companyId,
      ledgerName: "Ambika Dyeing Job Work A/c",
      groupId: groupMap.get("Direct Expenses"),
      ledgerType: "general",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    const [ledgerMillWork] = await tx.insert(mLedgers).values({
      companyId,
      ledgerName: "Krishna Processors Mill Work A/c",
      groupId: groupMap.get("Direct Expenses"),
      ledgerType: "general",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    const [ledgerTax] = await tx.insert(mLedgers).values({
      companyId,
      ledgerName: "GST Tax Paid/Collected",
      ledgerType: "tax",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    const [ledgerRent] = await tx.insert(mLedgers).values({
      companyId,
      ledgerName: "Office Rent A/c",
      groupId: groupMap.get("Direct Expenses"),
      ledgerType: "general",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    // Customer reference ledgers (now mapped as company/party type)
    const [ledgerRamesh] = await tx.insert(mLedgers).values({
      companyId,
      ledgerName: "Ramesh Fabric Traders",
      groupId: groupMap.get("Sundry Debtors"),
      ledgerType: "company",
      referenceId: Number(custRamesh.companyId),
      gstNo: custRamesh.gstNo,
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    const [ledgerShreeji] = await tx.insert(mLedgers).values({
      companyId,
      ledgerName: "Shreeji Outfits",
      groupId: groupMap.get("Sundry Debtors"),
      ledgerType: "company",
      referenceId: Number(custShreeji.companyId),
      gstNo: custShreeji.gstNo,
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    // Supplier reference ledgers
    const [ledgerGanesh] = await tx.insert(mLedgers).values({
      companyId,
      ledgerName: "Ganesh Yarn Suppliers",
      groupId: groupMap.get("Sundry Creditors"),
      ledgerType: "company",
      referenceId: Number(supplierGanesh.companyId),
      gstNo: supplierGanesh.gstNo,
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    const [ledgerApex] = await tx.insert(mLedgers).values({
      companyId,
      ledgerName: "Apex Weaving Factory",
      groupId: groupMap.get("Sundry Creditors"),
      ledgerType: "company",
      referenceId: Number(supplierApex.companyId),
      gstNo: supplierApex.gstNo,
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    // 15. Vouchers and Postings
    console.log("Inserting transaction vouchers & postings...");

    // Helper: Create a voucher
    async function createVoucher(data: {
      voucherType: string;
      voucherNo: string;
      voucherDate: string;
      partyId?: number;
      remarks?: string;
      totalAmount: string;
      taxAmount: string;
      netAmount: string;
      invoiceNo?: string;
      invoiceDate?: string;
      goodsName?: string;
      cashBankLedgerId?: number;
      lotNo?: string;
    }) {
      const [v] = await tx.insert(tVouchers).values({
        companyId,
        voucherType: data.voucherType,
        voucherNo: data.voucherNo,
        voucherDate: data.voucherDate,
        partyId: data.partyId,
        remarks: data.remarks || null,
        status: "posted",
        totalAmount: data.totalAmount,
        taxAmount: data.taxAmount,
        netAmount: data.netAmount,
        invoiceNo: data.invoiceNo || null,
        invoiceDate: data.invoiceDate || null,
        goodsName: data.goodsName || null,
        cashBankLedgerId: data.cashBankLedgerId || null,
        lotNo: data.lotNo || null,
        printRate: true,
        printAmount: true,
        createdBy: userId,
        updatedBy: userId,
      }).returning();
      return Number(v.voucherId);
    }

    // 15.1. Purchase from Apex Weaving Factory (Cotton Grey 40/40, 1000 MTR @ 42.00, 5% GST)
    // Taxable: 42,000.00, GST: 2,100.00 (CGST 1,050.00, SGST 1,050.00), Net: 44,100.00
    const vPurch1Id = await createVoucher({
      voucherType: "purchase",
      voucherNo: "PUR-2026-0001",
      voucherDate: "2026-04-10",
      partyId: Number(supplierApex.companyId),
      invoiceNo: "AWF-1029",
      invoiceDate: "2026-04-09",
      goodsName: "Cotton Grey Fabric",
      totalAmount: "42000.00",
      taxAmount: "2100.00",
      netAmount: "44100.00",
    });

    await tx.insert(tVoucherItems).values({
      voucherId: vPurch1Id,
      inventoryId: Number(invCottonGrey.inventoryId),
      hsnCode: "5208",
      pcs: 20,
      quantity: "1000.0000",
      fold: "100.00",
      rate: "42.00",
      gstRateId: Number(tax5.taxRateId),
      taxableAmount: "42000.00",
      cgst: "1050.00",
      sgst: "1050.00",
      igst: "0.00",
      netAmount: "44100.00",
      createdBy: userId,
      updatedBy: userId,
    });

    // Accounting postings for Purchase
    await tx.insert(tVoucherEntries).values([
      { voucherId: vPurch1Id, ledgerId: Number(ledgerApex.ledgerId), entryType: "credit", amount: "44100.00", createdBy: userId, updatedBy: userId },
      { voucherId: vPurch1Id, ledgerId: Number(ledgerPurchase.ledgerId), entryType: "debit", amount: "42000.00", createdBy: userId, updatedBy: userId },
      { voucherId: vPurch1Id, ledgerId: Number(ledgerTax.ledgerId), entryType: "debit", amount: "2100.00", createdBy: userId, updatedBy: userId },
    ]);

    // Stock movement for Purchase
    await tx.insert(tStockMovements).values({
      companyId,
      inventoryId: Number(invCottonGrey.inventoryId),
      voucherId: vPurch1Id,
      movementType: "purchase",
      quantity: "1000.0000",
      rate: "42.00",
      amount: "42000.00",
      createdBy: userId,
      updatedBy: userId,
    });

    // 15.2. Job Outward to Ambika Dyeing & Printing (1000 MTR of Cotton Grey)
    const vJobOutId = await createVoucher({
      voucherType: "job_outward",
      voucherNo: "JO-2026-0001",
      voucherDate: "2026-04-12",
      partyId: Number(jobAmbika.jobId),
      lotNo: "LOT-001",
      totalAmount: "0.00",
      taxAmount: "0.00",
      netAmount: "0.00",
    });

    await tx.insert(tVoucherItems).values({
      voucherId: vJobOutId,
      inventoryId: Number(invCottonGrey.inventoryId),
      pcs: 20,
      quantity: "1000.0000",
      fold: "100.00",
      rate: "0.00",
      taxableAmount: "0.00",
      cgst: "0.00",
      sgst: "0.00",
      igst: "0.00",
      netAmount: "0.00",
      jobType: "dyeing",
      jobRateType: "mtr",
      createdBy: userId,
      updatedBy: userId,
    });

    // Stock movement (outward raw stock)
    await tx.insert(tStockMovements).values({
      companyId,
      inventoryId: Number(invCottonGrey.inventoryId),
      voucherId: vJobOutId,
      movementType: "adjustment",
      quantity: "-1000.0000",
      rate: "0.00",
      amount: "0.00",
      createdBy: userId,
      updatedBy: userId,
    });

    // 15.3. Job Inward from Ambika Dyeing & Printing (980 MTR Polyester Finished Satin, with 20 MTR shortage)
    const vJobInId = await createVoucher({
      voucherType: "job_inward",
      voucherNo: "JI-2026-0001",
      voucherDate: "2026-04-20",
      partyId: Number(jobAmbika.jobId),
      lotNo: "LOT-001",
      totalAmount: "0.00",
      taxAmount: "0.00",
      netAmount: "0.00",
    });

    await tx.insert(tVoucherItems).values({
      voucherId: vJobInId,
      inventoryId: Number(invPolySatin.inventoryId),
      pcs: 20,
      quantity: "980.0000",
      fold: "100.00",
      rate: "0.00",
      taxableAmount: "0.00",
      cgst: "0.00",
      sgst: "0.00",
      igst: "0.00",
      netAmount: "0.00",
      createdBy: userId,
      updatedBy: userId,
    });

    // Stock movement (inward finished stock)
    await tx.insert(tStockMovements).values({
      companyId,
      inventoryId: Number(invPolySatin.inventoryId),
      voucherId: vJobInId,
      movementType: "adjustment",
      quantity: "980.0000",
      rate: "0.00",
      amount: "0.00",
      createdBy: userId,
      updatedBy: userId,
    });

    // 15.4. Sale to Ramesh Fabric Traders (Polyester Finished Satin, 500 MTR @ 120.00, 12% GST)
    // Taxable: 60,000.00, GST: 7,200.00 (CGST 3,600.00, SGST 3,600.00), Net: 67,200.00
    const vSale1Id = await createVoucher({
      voucherType: "sale",
      voucherNo: "SAL-2026-0001",
      voucherDate: "2026-04-22",
      partyId: Number(custRamesh.companyId),
      invoiceNo: "TX-001",
      invoiceDate: "2026-04-22",
      goodsName: "Finished Satin Fabric",
      totalAmount: "60000.00",
      taxAmount: "7200.00",
      netAmount: "67200.00",
    });

    await tx.insert(tVoucherItems).values({
      voucherId: vSale1Id,
      inventoryId: Number(invPolySatin.inventoryId),
      hsnCode: "5407",
      pcs: 10,
      quantity: "500.0000",
      fold: "100.00",
      rate: "120.00",
      gstRateId: Number(tax12.taxRateId),
      taxableAmount: "60000.00",
      cgst: "3600.00",
      sgst: "3600.00",
      igst: "0.00",
      netAmount: "67200.00",
      createdBy: userId,
      updatedBy: userId,
    });

    // Accounting postings for Sale 1
    await tx.insert(tVoucherEntries).values([
      { voucherId: vSale1Id, ledgerId: Number(ledgerRamesh.ledgerId), entryType: "debit", amount: "67200.00", createdBy: userId, updatedBy: userId },
      { voucherId: vSale1Id, ledgerId: Number(ledgerSales.ledgerId), entryType: "credit", amount: "60000.00", createdBy: userId, updatedBy: userId },
      { voucherId: vSale1Id, ledgerId: Number(ledgerTax.ledgerId), entryType: "credit", amount: "7200.00", createdBy: userId, updatedBy: userId },
    ]);

    // Stock movement for Sale 1
    await tx.insert(tStockMovements).values({
      companyId,
      inventoryId: Number(invPolySatin.inventoryId),
      voucherId: vSale1Id,
      movementType: "sale",
      quantity: "500.0000",
      rate: "120.00",
      amount: "60000.00",
      createdBy: userId,
      updatedBy: userId,
    });

    // 15.5. Interstate Sale to Shreeji Outfits (Polyester Finished Satin, 400 MTR @ 125.00, 12% GST)
    // Taxable: 50,000.00, IGST: 6,000.00, Net: 56,000.00
    const vSale2Id = await createVoucher({
      voucherType: "sale",
      voucherNo: "SAL-2026-0002",
      voucherDate: "2026-04-25",
      partyId: Number(custShreeji.companyId),
      invoiceNo: "TX-002",
      invoiceDate: "2026-04-25",
      goodsName: "Finished Satin Fabric",
      totalAmount: "50000.00",
      taxAmount: "6000.00",
      netAmount: "56000.00",
    });

    await tx.insert(tVoucherItems).values({
      voucherId: vSale2Id,
      inventoryId: Number(invPolySatin.inventoryId),
      hsnCode: "5407",
      pcs: 8,
      quantity: "400.0000",
      fold: "100.00",
      rate: "125.00",
      gstRateId: Number(tax12.taxRateId),
      taxableAmount: "50000.00",
      cgst: "0.00",
      sgst: "0.00",
      igst: "6000.00",
      netAmount: "56000.00",
      createdBy: userId,
      updatedBy: userId,
    });

    // Accounting postings for Sale 2
    await tx.insert(tVoucherEntries).values([
      { voucherId: vSale2Id, ledgerId: Number(ledgerShreeji.ledgerId), entryType: "debit", amount: "56000.00", createdBy: userId, updatedBy: userId },
      { voucherId: vSale2Id, ledgerId: Number(ledgerSales.ledgerId), entryType: "credit", amount: "50000.00", createdBy: userId, updatedBy: userId },
      { voucherId: vSale2Id, ledgerId: Number(ledgerTax.ledgerId), entryType: "credit", amount: "6000.00", createdBy: userId, updatedBy: userId },
    ]);

    // Stock movement for Sale 2
    await tx.insert(tStockMovements).values({
      companyId,
      inventoryId: Number(invPolySatin.inventoryId),
      voucherId: vSale2Id,
      movementType: "sale",
      quantity: "400.0000",
      rate: "125.00",
      amount: "50000.00",
      createdBy: userId,
      updatedBy: userId,
    });

    // 15.6. Receipt from Ramesh Fabric Traders (30,000.00 received in State Bank of India A/c)
    const vReceiptId = await createVoucher({
      voucherType: "receipt",
      voucherNo: "REC-2026-0001",
      voucherDate: "2026-04-28",
      partyId: Number(custRamesh.companyId),
      cashBankLedgerId: Number(ledgerSBI.ledgerId),
      remarks: "Part payment received",
      totalAmount: "30000.00",
      taxAmount: "0.00",
      netAmount: "30000.00",
    });

    await tx.insert(tVoucherEntries).values([
      { voucherId: vReceiptId, ledgerId: Number(ledgerSBI.ledgerId), entryType: "debit", amount: "30000.00", createdBy: userId, updatedBy: userId },
      { voucherId: vReceiptId, ledgerId: Number(ledgerRamesh.ledgerId), entryType: "credit", amount: "30000.00", createdBy: userId, updatedBy: userId },
    ]);

    // 15.7. Payment to Apex Weaving Factory (20,000.00 paid from State Bank of India A/c)
    const vPaymentId = await createVoucher({
      voucherType: "payment",
      voucherNo: "PAY-2026-0001",
      voucherDate: "2026-04-29",
      partyId: Number(supplierApex.companyId),
      cashBankLedgerId: Number(ledgerSBI.ledgerId),
      remarks: "Advance payment to weaving mill",
      totalAmount: "20000.00",
      taxAmount: "0.00",
      netAmount: "20000.00",
    });

    await tx.insert(tVoucherEntries).values([
      { voucherId: vPaymentId, ledgerId: Number(ledgerSBI.ledgerId), entryType: "credit", amount: "20000.00", createdBy: userId, updatedBy: userId },
      { voucherId: vPaymentId, ledgerId: Number(ledgerApex.ledgerId), entryType: "debit", amount: "20000.00", createdBy: userId, updatedBy: userId },
    ]);

    // 15.8. Direct Bill for consumables (GYS-9921 from Ganesh Yarn Suppliers)
    // Taxable: 8,000.00, GST: 1,440.00 (CGST 720.00, SGST 720.00), Net: 9,440.00
    const vDirectBillId = await createVoucher({
      voucherType: "direct_bill",
      voucherNo: "DB-2026-0001",
      voucherDate: "2026-04-15",
      partyId: Number(supplierGanesh.companyId),
      invoiceNo: "GYS-9921",
      invoiceDate: "2026-04-14",
      goodsName: "Consumable dye chemicals",
      totalAmount: "8000.00",
      taxAmount: "1440.00",
      netAmount: "9440.00",
    });

    await tx.insert(tVoucherItems).values({
      voucherId: vDirectBillId,
      inventoryId: Number(invDyesBlack.inventoryId),
      hsnCode: "3204",
      pcs: 0,
      quantity: "32.0000",
      fold: "100.00",
      rate: "250.00",
      gstRateId: Number(tax18.taxRateId),
      taxableAmount: "8000.00",
      cgst: "720.00",
      sgst: "720.00",
      igst: "0.00",
      netAmount: "9440.00",
      createdBy: userId,
      updatedBy: userId,
    });

    await tx.insert(tVoucherEntries).values([
      { voucherId: vDirectBillId, ledgerId: Number(ledgerGanesh.ledgerId), entryType: "credit", amount: "9440.00", createdBy: userId, updatedBy: userId },
      { voucherId: vDirectBillId, ledgerId: Number(ledgerPurchase.ledgerId), entryType: "debit", amount: "8000.00", createdBy: userId, updatedBy: userId },
      { voucherId: vDirectBillId, ledgerId: Number(ledgerTax.ledgerId), entryType: "debit", amount: "1440.00", createdBy: userId, updatedBy: userId },
    ]);

    // 15.9. Journal Voucher (depreciation/rent adjustment)
    const vJournalId = await createVoucher({
      voucherType: "journal",
      voucherNo: "JV-2026-0001",
      voucherDate: "2026-04-30",
      remarks: "Rent adjustment for April 2026",
      totalAmount: "15000.00",
      taxAmount: "0.00",
      netAmount: "15000.00",
    });

    await tx.insert(tVoucherEntries).values([
      { voucherId: vJournalId, ledgerId: Number(ledgerRent.ledgerId), entryType: "debit", amount: "15000.00", createdBy: userId, updatedBy: userId },
      { voucherId: vJournalId, ledgerId: Number(ledgerCash.ledgerId), entryType: "credit", amount: "15000.00", createdBy: userId, updatedBy: userId },
    ]);

    // 15.10. Credit Note (Polyester Finished Satin returned by Ramesh Fabric Traders)
    // Taxable: 2,400.00, GST: 288.00 (CGST 144.00, SGST 144.00), Net: 2,688.00
    const vCreditNoteId = await createVoucher({
      voucherType: "credit_note",
      voucherNo: "CN-2026-0001",
      voucherDate: "2026-04-24",
      partyId: Number(custRamesh.companyId),
      invoiceNo: "TX-001",
      invoiceDate: "2026-04-22",
      goodsName: "Polyester Finished Satin",
      remarks: "Returned Polyester Finished Satin due to print defect",
      totalAmount: "2400.00",
      taxAmount: "288.00",
      netAmount: "2688.00",
    });

    await tx.insert(tVoucherItems).values({
      voucherId: vCreditNoteId,
      inventoryId: Number(invPolySatin.inventoryId),
      hsnCode: "5407",
      pcs: 0,
      quantity: "20.0000",
      fold: "100.00",
      rate: "120.00",
      gstRateId: Number(tax12.taxRateId),
      taxableAmount: "2400.00",
      cgst: "144.00",
      sgst: "144.00",
      igst: "0.00",
      netAmount: "2688.00",
      createdBy: userId,
      updatedBy: userId,
    });

    await tx.insert(tVoucherEntries).values([
      { voucherId: vCreditNoteId, ledgerId: Number(ledgerRamesh.ledgerId), entryType: "credit", amount: "2688.00", createdBy: userId, updatedBy: userId },
      { voucherId: vCreditNoteId, ledgerId: Number(ledgerSales.ledgerId), entryType: "debit", amount: "2400.00", createdBy: userId, updatedBy: userId },
      { voucherId: vCreditNoteId, ledgerId: Number(ledgerTax.ledgerId), entryType: "debit", amount: "288.00", createdBy: userId, updatedBy: userId },
    ]);

    await tx.insert(tStockMovements).values({
      companyId,
      inventoryId: Number(invPolySatin.inventoryId),
      voucherId: vCreditNoteId,
      movementType: "adjustment",
      quantity: "-20.0000",
      rate: "120.00",
      amount: "2400.00",
      createdBy: userId,
      updatedBy: userId,
    });

    // 15.11. Debit Note (rate difference adjustment on Purchase from Apex Weaving)
    // Taxable: 200.00, GST: 10.00 (CGST 5.00, SGST 5.00), Net: 210.00
    const vDebitNoteId = await createVoucher({
      voucherType: "debit_note",
      voucherNo: "DN-2026-0001",
      voucherDate: "2026-04-18",
      partyId: Number(supplierApex.companyId),
      invoiceNo: "AWF-1029",
      invoiceDate: "2026-04-09",
      goodsName: "Cotton Grey Fabric",
      remarks: "Rate difference adjustment",
      totalAmount: "200.00",
      taxAmount: "10.00",
      netAmount: "210.00",
    });

    await tx.insert(tVoucherItems).values({
      voucherId: vDebitNoteId,
      inventoryId: Number(invCottonGrey.inventoryId),
      hsnCode: "5208",
      pcs: 0,
      quantity: "100.0000",
      fold: "100.00",
      rate: "2.00",
      gstRateId: Number(tax5.taxRateId),
      taxableAmount: "200.00",
      cgst: "5.00",
      sgst: "5.00",
      igst: "0.00",
      netAmount: "210.00",
      createdBy: userId,
      updatedBy: userId,
    });

    await tx.insert(tVoucherEntries).values([
      { voucherId: vDebitNoteId, ledgerId: Number(ledgerApex.ledgerId), entryType: "debit", amount: "210.00", createdBy: userId, updatedBy: userId },
      { voucherId: vDebitNoteId, ledgerId: Number(ledgerPurchase.ledgerId), entryType: "credit", amount: "200.00", createdBy: userId, updatedBy: userId },
      { voucherId: vDebitNoteId, ledgerId: Number(ledgerTax.ledgerId), entryType: "credit", amount: "10.00", createdBy: userId, updatedBy: userId },
    ]);

    await tx.insert(tStockMovements).values({
      companyId,
      inventoryId: Number(invCottonGrey.inventoryId),
      voucherId: vDebitNoteId,
      movementType: "adjustment",
      quantity: "-100.0000",
      rate: "2.00",
      amount: "200.00",
      createdBy: userId,
      updatedBy: userId,
    });

    // 15.12. Lot Transfer (LOT-001 from Ambika to Krishna Processors for final finishing)
    await createVoucher({
      voucherType: "lot_transfer",
      voucherNo: "LT-2026-0001",
      voucherDate: "2026-04-26",
      partyId: Number(millKrishna.millId),
      lotNo: "LOT-001",
      remarks: "Transferred LOT-001 from Ambika to Krishna Processors for final finishing",
      totalAmount: "0.00",
      taxAmount: "0.00",
      netAmount: "0.00",
    });

    console.log("Database seeded successfully with company data!");
  });
}

// Execute if run directly as a script
if (process.argv[1] && (process.argv[1].endsWith("real_seed.ts") || process.argv[1].endsWith("real_seed.js"))) {
  seedRealData()
    .then(() => {
      console.log("Seed completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
