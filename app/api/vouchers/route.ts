import { db } from "@/lib/db";
import {
  mLedgers,
  mInventory,
  mTaxRates,
  mJobs,
  mMills,
  mCompanies,
  tVouchers,
  tVoucherEntries,
  tStockMovements,
  tVoucherItems,
  mVoucherSequences,
} from "@/lib/db/schema";
import { and, eq, isNull, desc, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { calculatePreTaxDiscount } from "@/lib/utils";

const DEFAULT_PREFIXES: Record<string, string> = {
  sale: "S-",
  purchase: "P-",
  purchase_return: "PR-",
  credit_note: "CN-",
  debit_note: "DN-",
  receipt: "R-",
  payment: "PM-",
  journal: "J-",
  job_outward: "JO-",
  job_inward: "JI-",
  mill_outward: "MO-",
  mill_inward: "MI-",
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  const userId = session.user.id;
  const companyId = Number(session.user.companyId);
  const body = await request.json();
  const {
    voucherType,
    voucherNo,
    voucherDate,
    invoiceNo,
    invoiceDate,
    goodsName,
    partyId,
    remarks,
    jobStatus,
    lineItems,
    cashBankLedgerId,
    totalAmount,
    broker,
    haste,
    lrNo,
    lrDate,
    transport,
    vehicleNo,
    personName,
    lotNo,
    printRate = true,
    printAmount = true,
    parentVoucherId,
    billDetails,
    isReversal,
    discountType,
    discountValue,
    discountType2,
    discountValue2,
    extraCharges,
    extraChargesData,
    bankName,
    paymentMethod,
  } = body;

  if (!voucherType || !voucherNo || !voucherDate) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  try {
    const [voucher] = await db.transaction(async (tx) => {
      // Support both legacy numeric extraCharges and new array extraChargesData
      const extraChargesNum = Number(extraCharges) || 0;
      // Handle sequence number generation
      let finalVoucherNo = voucherNo;
      const seq = await tx.query.mVoucherSequences.findFirst({
        where: and(
          eq(mVoucherSequences.companyId, companyId),
          eq(mVoucherSequences.voucherType, voucherType),
        ),
      });

      if (seq) {
        finalVoucherNo = `${seq.prefix}${seq.nextNumber}`;
        await tx
          .update(mVoucherSequences)
          .set({ nextNumber: seq.nextNumber + 1 })
          .where(eq(mVoucherSequences.sequenceId, seq.sequenceId));
      } else {
        const prefix =
          DEFAULT_PREFIXES[voucherType] ||
          `${voucherType.toUpperCase().substring(0, 3)}-`;
        await tx.insert(mVoucherSequences).values({
          companyId,
          voucherType,
          prefix,
          nextNumber: 2,
          createdBy: userId,
          updatedBy: userId,
        });
        finalVoucherNo = `${prefix}1`;
      }

      // Determine interstate vs intrastate GST based on state/GSTIN prefix
      const company = await tx.query.mCompanies.findFirst({
        where: eq(mCompanies.companyId, companyId),
      });
      const companyGst = company?.gstNo || "";
      const companyState = company?.state || "";
      let partyGstNo = "";
      let partyState = "";
      let partyStateCode = "";

      if (partyId) {
        if (
          voucherType === "sale" ||
          voucherType === "credit_note" ||
          voucherType === "debit_note" ||
          voucherType === "purchase_return"
        ) {
          const cust = await tx.query.mCompanies.findFirst({
            where: eq(mCompanies.companyId, Number(partyId)),
          });
          partyGstNo = cust?.gstNo || "";
          partyState = cust?.state || "";
        } else if (
          voucherType === "purchase" ||
          voucherType === "direct_bill"
        ) {
          const compObj = await tx.query.mCompanies.findFirst({
            where: eq(mCompanies.companyId, Number(partyId)),
          });
          partyGstNo = compObj?.gstNo || "";
          partyState = compObj?.state || "";
        } else if (
          voucherType === "job_outward" ||
          voucherType === "job_inward"
        ) {
          const job = await tx.query.mJobs.findFirst({
            where: eq(mJobs.jobId, Number(partyId)),
          });
          partyGstNo = job?.gstNo || "";
          partyStateCode = job?.stateCode || "";
        } else if (
          voucherType === "mill_outward" ||
          voucherType === "mill_inward"
        ) {
          const mill = await tx.query.mMills.findFirst({
            where: eq(mMills.millId, Number(partyId)),
          });
          partyGstNo = mill?.gstNo || "";
          partyStateCode = mill?.stateCode || "";
        }
      }

      let isInterstate = false;
      if (companyState && partyState) {
        isInterstate =
          companyState.trim().toLowerCase() !== partyState.trim().toLowerCase();
      } else if (company?.stateCode && partyStateCode) {
        isInterstate =
          company.stateCode.trim().toLowerCase() !==
          partyStateCode.trim().toLowerCase();
      } else if (companyGst && partyGstNo) {
        isInterstate = companyGst.slice(0, 2) !== partyGstNo.slice(0, 2);
      }

      // Calculate totals based on voucher type
      let computedTotal = 0;
      let computedTax = 0;
      let computedNet = 0;

      const processedLines: any[] = [];

      if (
        voucherType === "sale" ||
        voucherType === "purchase" ||
        voucherType === "credit_note" ||
        voucherType === "debit_note" ||
        voucherType === "purchase_return" ||
        voucherType === "job_outward" ||
        voucherType === "job_inward" ||
        voucherType === "mill_outward" ||
        voucherType === "mill_inward" ||
        voucherType === "direct_bill"
      ) {
        if (!Array.isArray(lineItems) || lineItems.length === 0) {
          throw new Error("Line items are required for this voucher type");
        }

        let rawTotal = 0;
        const linesInfo = lineItems.map((line) => {
          const pcs = Number(line.pcs) || 0;
          const qty = Number(line.quantity) || 0;
          const rate = Number(line.rate) || 0;
          const fold = Number(line.fold !== undefined ? line.fold : 100) || 100;
          const jobRateType = line.jobRateType || "mtr";

          const unit = jobRateType === "pcs" ? pcs : qty;
          const rawTaxableAmount =
            Math.round(((unit * rate * fold) / 100) * 100) / 100;
          rawTotal += rawTaxableAmount;
          return { line, rawTaxableAmount, pcs, qty, rate, fold, jobRateType };
        });

        for (const {
          line,
          rawTaxableAmount,
          pcs,
          qty,
          rate,
          fold,
          jobRateType,
        } of linesInfo) {
          const lineDiscount1 = calculatePreTaxDiscount(
            rawTaxableAmount,
            rawTotal,
            discountType,
            discountValue,
          );
          const lineDiscount2 = calculatePreTaxDiscount(
            rawTaxableAmount,
            rawTotal,
            discountType2,
            discountValue2,
          );
          const totalLineDiscount = lineDiscount1 + lineDiscount2;
          const taxableAmount = Math.max(
            0,
            Math.round((rawTaxableAmount - totalLineDiscount) * 100) / 100,
          );

          let cgst = line.cgst !== undefined ? Number(line.cgst) : 0;
          let sgst = line.sgst !== undefined ? Number(line.sgst) : 0;
          let igst = line.igst !== undefined ? Number(line.igst) : 0;

          if (
            line.gstRateId &&
            line.cgst === undefined &&
            line.sgst === undefined &&
            line.igst === undefined
          ) {
            const taxRate = await tx.query.mTaxRates.findFirst({
              where: eq(mTaxRates.taxRateId, Number(line.gstRateId)),
            });
            if (taxRate) {
              const taxPercent = Number(taxRate.taxPercent || 0);
              const totalTax =
                Math.round(((taxableAmount * taxPercent) / 100) * 100) / 100;
              if (isInterstate) {
                igst = totalTax;
              } else {
                cgst = Math.round((totalTax / 2) * 100) / 100;
                sgst = Math.round((totalTax - cgst) * 100) / 100;
              }
            }
          }

          const lineTax = cgst + sgst + igst;
          const lineNet = taxableAmount + lineTax;

          computedTotal += taxableAmount;
          computedTax += lineTax;
          computedNet += lineNet;

          processedLines.push({
            ...line,
            qty,
            rate,
            fold,
            taxableAmount,
            cgst,
            sgst,
            igst,
            lineNet,
          });
        }
        computedNet = Math.round((computedNet + extraChargesNum) * 100) / 100;
      } else if (voucherType === "receipt" || voucherType === "payment") {
        computedTotal = Number(totalAmount || 0);
        computedNet = computedTotal;
      } else if (voucherType === "journal") {
        if (!Array.isArray(lineItems) || lineItems.length === 0) {
          throw new Error("Line items are required for journal vouchers");
        }
        const debits = lineItems
          .filter((l: any) => l.entryType === "debit")
          .reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0);
        const credits = lineItems
          .filter((l: any) => l.entryType === "credit")
          .reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0);
        if (Math.abs(debits - credits) > 0.01) {
          throw new Error(
            "Debits and credits do not balance in journal voucher",
          );
        }
        computedTotal = debits;
        computedNet = debits;
      }

      // Insert Voucher Summary
      const [createdVoucher] = await tx
        .insert(tVouchers)
        .values({
          companyId,
          voucherType,
          voucherNo: finalVoucherNo,
          voucherDate: String(voucherDate),
          partyId: partyId ? Number(partyId) : null,
          remarks: remarks || null,
          jobStatus: jobStatus || null,
          status: "posted",
          totalAmount: String(computedTotal),
          taxAmount: String(computedTax),
          netAmount: String(computedNet),
          broker: broker || null,
          haste: haste || null,
          lrNo: lrNo || null,
          lrDate: lrDate ? String(lrDate) : null,
          transport: transport || null,
          vehicleNo: vehicleNo || null,
          personName: personName || null,
          lotNo: lotNo || null,
          invoiceNo: invoiceNo || null,
          invoiceDate: invoiceDate ? String(invoiceDate) : null,
          goodsName: goodsName || null,
          printRate: printRate,
          printAmount: printAmount,
          parentVoucherId: parentVoucherId ? Number(parentVoucherId) : null,
          cashBankLedgerId: cashBankLedgerId ? Number(cashBankLedgerId) : null,
          billDetails: billDetails || null,
          discountType: discountType || null,
          discountValue: discountValue ? String(discountValue) : null,
          discountType2: discountType2 || null,
          discountValue2: discountValue2 ? String(discountValue2) : null,
          extraCharges: extraCharges ? String(extraCharges) : "0.00",
          extraChargesData: extraChargesData ?? null,
          bankName: bankName || null,
          paymentMethod: paymentMethod || null,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      const voucherIdNum = Number(createdVoucher.voucherId);

      // Helper to find or create a Tax/GST ledger
      const getOrCreateTaxLedger = async () => {
        let ledger = await tx.query.mLedgers.findFirst({
          where: and(
            eq(mLedgers.companyId, companyId),
            eq(mLedgers.ledgerType, "tax"),
            isNull(mLedgers.deletedOn),
          ),
        });
        if (!ledger) {
          const [newL] = await tx
            .insert(mLedgers)
            .values({
              companyId,
              ledgerName: "GST Tax Paid/Collected",
              ledgerType: "tax",
              createdBy: userId,
              updatedBy: userId,
            })
            .returning();
          ledger = newL;
        }
        return ledger;
      };

      const getOrCreateExtraChargesLedger = async () => {
        let ledger = await tx.query.mLedgers.findFirst({
          where: and(
            eq(mLedgers.companyId, companyId),
            eq(mLedgers.ledgerName, "Freight & Other Charges A/c"),
            isNull(mLedgers.deletedOn),
          ),
        });
        if (!ledger) {
          const [newL] = await tx
            .insert(mLedgers)
            .values({
              companyId,
              ledgerName: "Freight & Other Charges A/c",
              ledgerType: "general",
              createdBy: userId,
              updatedBy: userId,
            })
            .returning();
          ledger = newL;
        }
        return ledger;
      };

      // Insert Entries and Stock Movements
      if (voucherType === "sale" || voucherType === "credit_note") {
        // 1. Debit Party Ledger
        const partyLedger = await tx.query.mLedgers.findFirst({
          where: and(
            eq(mLedgers.referenceId, Number(partyId)),
            eq(mLedgers.ledgerType, "company"),
            eq(mLedgers.companyId, companyId),
            isNull(mLedgers.deletedOn),
          ),
        });
        if (!partyLedger) throw new Error("Party ledger not found");

        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(partyLedger.ledgerId),
          entryType: voucherType === "sale" ? "debit" : "credit",
          amount: String(computedNet),
          createdBy: userId,
          updatedBy: userId,
        });

        // 2. Insert item details, ledger postings, and stock movements
        for (const line of processedLines) {
          await tx.insert(tVoucherItems).values({
            voucherId: voucherIdNum,
            inventoryId: (line.inventoryId && !isNaN(Number(line.inventoryId))) ? Number(line.inventoryId) : null,
            ledgerId: (line.ledgerId && !isNaN(Number(line.ledgerId))) ? Number(line.ledgerId) : null,
            hsnCode: line.hsnCode || null,
            pcs: Number(line.pcs || 0),
            quantity: String(line.qty),
            fold: String(line.fold),
            rate: String(line.rate),
            gstRateId: line.gstRateId ? Number(line.gstRateId) : null,
            taxableAmount: String(line.taxableAmount),
            cgst: String(line.cgst),
            sgst: String(line.sgst),
            igst: String(line.igst),
            netAmount: String(line.lineNet),
            jobType: line.jobType || null,
            jobRateType: line.jobRateType || null,
            pieceMeters: line.pieceMeters
              ? JSON.stringify(line.pieceMeters)
              : null,
            createdBy: userId,
            updatedBy: userId,
          });

          // Credit / Debit Revenue Account — only if ledgerId explicitly provided
          const lineLedgerId = Number(line.ledgerId) || 0;
          if (lineLedgerId) {
            await tx.insert(tVoucherEntries).values({
              voucherId: voucherIdNum,
              ledgerId: lineLedgerId,
              entryType: voucherType === "sale" ? "credit" : "debit",
              amount: String(line.taxableAmount),
              createdBy: userId,
              updatedBy: userId,
            });
          }

          // Tax Ledger Entries
          const taxLedger = await getOrCreateTaxLedger();
          const totalLineTax = line.cgst + line.sgst + line.igst;
          if (totalLineTax > 0) {
            await tx.insert(tVoucherEntries).values({
              voucherId: voucherIdNum,
              ledgerId: Number(taxLedger.ledgerId),
              entryType: voucherType === "sale" ? "credit" : "debit",
              amount: String(totalLineTax),
              createdBy: userId,
              updatedBy: userId,
            });
          }

          // Stock movements
          const lineInventoryId = (line.inventoryId && !isNaN(Number(line.inventoryId))) ? Number(line.inventoryId) : null;
          if (lineInventoryId) {
            const item = await tx.query.mInventory.findFirst({
              where: eq(mInventory.inventoryId, lineInventoryId),
            });
            if (item) {
              await tx.insert(tStockMovements).values({
                companyId,
                inventoryId: Number(item.inventoryId),
                voucherId: voucherIdNum,
                movementType: voucherType === "sale" ? "sale" : "adjustment",
                quantity: String(voucherType === "sale" ? line.qty : -line.qty),
                rate: String(line.rate),
                amount: String(line.taxableAmount),
                createdBy: userId,
                updatedBy: userId,
              });
            }
          }
        }

        if (extraChargesNum > 0) {
          const extraLedger = await getOrCreateExtraChargesLedger();
          await tx.insert(tVoucherEntries).values({
            voucherId: voucherIdNum,
            ledgerId: Number(extraLedger.ledgerId),
            entryType: voucherType === "sale" ? "credit" : "debit",
            amount: String(extraChargesNum),
            createdBy: userId,
            updatedBy: userId,
          });
        }
      } else if (
        voucherType === "purchase" ||
        voucherType === "debit_note" ||
        voucherType === "purchase_return" ||
        voucherType === "direct_bill"
      ) {
        // 1. Credit Party Ledger
        const partyLedger = await tx.query.mLedgers.findFirst({
          where: and(
            eq(mLedgers.referenceId, Number(partyId)),
            eq(mLedgers.ledgerType, "company"),
            eq(mLedgers.companyId, companyId),
            isNull(mLedgers.deletedOn),
          ),
        });
        if (!partyLedger) throw new Error("Party ledger not found");

        const companyEntryType =
          voucherType === "purchase" || voucherType === "direct_bill"
            ? "credit"
            : "debit";
        const taxEntryType =
          voucherType === "purchase" || voucherType === "direct_bill"
            ? "debit"
            : "credit";

        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(partyLedger.ledgerId),
          entryType: companyEntryType,
          amount: String(computedNet),
          createdBy: userId,
          updatedBy: userId,
        });

        // 2. Insert item details, ledger postings, and stock movements
        for (const line of processedLines) {
          await tx.insert(tVoucherItems).values({
            voucherId: voucherIdNum,
            inventoryId: (line.inventoryId && !isNaN(Number(line.inventoryId))) ? Number(line.inventoryId) : null,
            ledgerId: (line.ledgerId && !isNaN(Number(line.ledgerId))) ? Number(line.ledgerId) : null,
            hsnCode: line.hsnCode || null,
            pcs: Number(line.pcs || 0),
            quantity: String(line.qty),
            fold: String(line.fold),
            rate: String(line.rate),
            gstRateId: line.gstRateId ? Number(line.gstRateId) : null,
            taxableAmount: String(line.taxableAmount),
            cgst: String(line.cgst),
            sgst: String(line.sgst),
            igst: String(line.igst),
            netAmount: String(line.lineNet),
            jobType: line.jobType || null,
            jobRateType: line.jobRateType || null,
            pieceMeters: line.pieceMeters
              ? JSON.stringify(line.pieceMeters)
              : null,
            createdBy: userId,
            updatedBy: userId,
          });

          // Tax Ledger Entries
          const taxLedger = await getOrCreateTaxLedger();
          const totalLineTax = line.cgst + line.sgst + line.igst;
          if (totalLineTax > 0) {
            await tx.insert(tVoucherEntries).values({
              voucherId: voucherIdNum,
              ledgerId: Number(taxLedger.ledgerId),
              entryType: taxEntryType,
              amount: String(totalLineTax),
              createdBy: userId,
              updatedBy: userId,
            });
          }

          // Stock movements (Only for standard trading purchases, not direct non-trading bills)
          if (voucherType !== "direct_bill") {
            const lineInventoryId = (line.inventoryId && !isNaN(Number(line.inventoryId))) ? Number(line.inventoryId) : null;
            if (lineInventoryId) {
              const item = await tx.query.mInventory.findFirst({
                where: eq(mInventory.inventoryId, lineInventoryId),
              });
              if (item) {
                await tx.insert(tStockMovements).values({
                  companyId,
                  inventoryId: Number(item.inventoryId),
                  voucherId: voucherIdNum,
                  movementType:
                    voucherType === "purchase" ? "purchase" : "adjustment",
                  quantity: String(
                    voucherType === "purchase" ? line.qty : -line.qty,
                  ),
                  rate: String(line.rate),
                  amount: String(line.taxableAmount),
                  createdBy: userId,
                  updatedBy: userId,
                });
              }
            }
          }
        }

        if (extraChargesNum > 0) {
          const extraLedger = await getOrCreateExtraChargesLedger();
          const extraEntryType =
            voucherType === "purchase" || voucherType === "direct_bill"
              ? "debit"
              : "credit";
          await tx.insert(tVoucherEntries).values({
            voucherId: voucherIdNum,
            ledgerId: Number(extraLedger.ledgerId),
            entryType: extraEntryType,
            amount: String(extraChargesNum),
            createdBy: userId,
            updatedBy: userId,
          });
        }
      } else if (
        voucherType === "job_outward" ||
        voucherType === "job_inward" ||
        voucherType === "mill_outward" ||
        voucherType === "mill_inward"
      ) {
        // Job work and mill movements. These represent stock transfers/adjustments.
        // We write to tVoucherItems and record stock movements without ledger double-entries.
        for (const line of processedLines) {
          await tx.insert(tVoucherItems).values({
            voucherId: voucherIdNum,
            inventoryId: Number(line.inventoryId),
            hsnCode: line.hsnCode || null,
            pcs: Number(line.pcs || 0),
            quantity: String(line.qty),
            fold: String(line.fold),
            rate: String(line.rate),
            gstRateId: line.gstRateId ? Number(line.gstRateId) : null,
            taxableAmount: String(line.taxableAmount),
            cgst: String(line.cgst),
            sgst: String(line.sgst),
            igst: String(line.igst),
            netAmount: String(line.lineNet),
            jobType: line.jobType || null,
            jobRateType: line.jobRateType || null,
            pieceMeters: line.pieceMeters
              ? JSON.stringify(line.pieceMeters)
              : null,
            createdBy: userId,
            updatedBy: userId,
          });

          // Stock movements
          const item = await tx.query.mInventory.findFirst({
            where: eq(mInventory.inventoryId, Number(line.inventoryId)),
          });
          if (item) {
            let movementTypeStr = "adjustment";
            let movementQty = line.qty;

            if (
              voucherType === "job_outward" ||
              voucherType === "mill_outward"
            ) {
              // Outward sends raw/grey stock out
              movementQty = -line.qty;
            } else {
              // Inward returns finished stock in
              movementQty = line.qty;
            }

            await tx.insert(tStockMovements).values({
              companyId,
              inventoryId: Number(item.inventoryId),
              voucherId: voucherIdNum,
              movementType: movementTypeStr,
              quantity: String(movementQty),
              rate: String(line.rate),
              amount: String(line.taxableAmount),
              createdBy: userId,
              updatedBy: userId,
            });
          }
        }
      } else if (voucherType === "receipt") {
        if (!cashBankLedgerId || !partyId)
          throw new Error(
            "Cash/Bank and Party account are required for Receipts",
          );
        const partyLedger = await tx.query.mLedgers.findFirst({
          where: and(
            eq(mLedgers.ledgerId, Number(partyId)),
            eq(mLedgers.companyId, companyId),
            isNull(mLedgers.deletedOn),
          ),
        });
        if (!partyLedger) throw new Error("Party ledger not found");

        const bankEntryType = isReversal ? "credit" : "debit";
        const partyEntryType = isReversal ? "debit" : "credit";

        // Bank Entry
        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(cashBankLedgerId),
          entryType: bankEntryType,
          amount: String(computedTotal),
          createdBy: userId,
          updatedBy: userId,
        });

        // Party Entry
        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(partyLedger.ledgerId),
          entryType: partyEntryType,
          amount: String(computedTotal),
          createdBy: userId,
          updatedBy: userId,
        });
      } else if (voucherType === "payment") {
        if (!cashBankLedgerId || !partyId)
          throw new Error(
            "Cash/Bank and Party account are required for Payments",
          );
        const partyLedger = await tx.query.mLedgers.findFirst({
          where: and(
            eq(mLedgers.ledgerId, Number(partyId)),
            eq(mLedgers.companyId, companyId),
            isNull(mLedgers.deletedOn),
          ),
        });
        if (!partyLedger) throw new Error("Party ledger not found");

        const bankEntryType = isReversal ? "debit" : "credit";
        const companyEntryType = isReversal ? "credit" : "debit";

        // Bank Entry
        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(cashBankLedgerId),
          entryType: bankEntryType,
          amount: String(computedTotal),
          createdBy: userId,
          updatedBy: userId,
        });

        // Party Entry
        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(partyLedger.ledgerId),
          entryType: companyEntryType,
          amount: String(computedTotal),
          createdBy: userId,
          updatedBy: userId,
        });
      } else if (voucherType === "journal") {
        for (const entry of lineItems) {
          await tx.insert(tVoucherEntries).values({
            voucherId: voucherIdNum,
            ledgerId: Number(entry.ledgerId),
            entryType: entry.entryType,
            amount: String(entry.amount),
            createdBy: userId,
            updatedBy: userId,
          });
        }
      }

      // Log Audit Event
      await writeAuditLog(tx, {
        tableName: "t_vouchers",
        recordId: voucherIdNum,
        actionType: "create",
        newDataJson: createdVoucher,
        createdBy: userId,
      });

      return [createdVoucher];
    });

    return NextResponse.json(voucher, { status: 201 });
  } catch (error: any) {
    console.error("Voucher error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create voucher" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId)
    return NextResponse.json({ error: "No company" }, { status: 400 });

  const companyId = Number(session.user.companyId);
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "sale";
  const partyId = searchParams.get("partyId");
  const includeItems = searchParams.get("includeItems") === "true";

  if (type === "outstanding") {
    if (!partyId)
      return NextResponse.json(
        { error: "partyId is required" },
        { status: 400 },
      );
    const pId = Number(partyId);

    const ledger = await db.query.mLedgers.findFirst({
      where: and(
        eq(mLedgers.ledgerId, pId),
        eq(mLedgers.companyId, companyId),
        isNull(mLedgers.deletedOn),
      ),
    });

    if (!ledger) {
      return NextResponse.json([]);
    }

    const resolvedPartyId = (ledger.ledgerType === "company" || ledger.ledgerType === "customer") ? ledger.referenceId : null;

    let invoiceType = searchParams.get("invoiceType");

    if (!invoiceType) {
      if (resolvedPartyId) {
        const subCompany = await db.query.mCompanies.findFirst({
          where: and(
            eq(mCompanies.companyId, resolvedPartyId),
            eq(mCompanies.parentCompanyId, companyId),
          ),
        });

        if (!subCompany) {
          return NextResponse.json([]);
        }
        invoiceType = "purchase";
      } else {
        return NextResponse.json([]);
      }
    }

    const paymentType = invoiceType === "sale" ? "receipt" : "payment";
    const noteType = invoiceType === "sale" ? "credit_note" : "debit_note";

    const invoices = await db
      .select({
        voucherId: tVouchers.voucherId,
        voucherNo: tVouchers.voucherNo,
        voucherDate: tVouchers.voucherDate,
        netAmount: tVouchers.netAmount,
      })
      .from(tVouchers)
      .where(
        and(
          eq(tVouchers.companyId, companyId),
          eq(tVouchers.voucherType, invoiceType),
          resolvedPartyId ? eq(tVouchers.partyId, resolvedPartyId) : eq(tVouchers.partyId, 0),
          isNull(tVouchers.deletedOn),
        ),
      )
      .orderBy(desc(tVouchers.voucherDate));

    const adjustments = await db
      .select({
        voucherId: tVouchers.voucherId,
        voucherType: tVouchers.voucherType,
        billDetails: tVouchers.billDetails,
      })
      .from(tVouchers)
      .where(
        and(
          eq(tVouchers.companyId, companyId),
          inArray(tVouchers.voucherType, [
            paymentType,
            noteType,
            "purchase_return",
          ]),
          resolvedPartyId
            ? or(eq(tVouchers.partyId, pId), eq(tVouchers.partyId, resolvedPartyId))
            : eq(tVouchers.partyId, pId),
          isNull(tVouchers.deletedOn),
        ),
      );

    const paidAmounts: Record<number, number> = {};
    for (const adj of adjustments) {
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

    const outstandingInvoices = invoices
      .map((inv) => {
        const netAmt = Number(inv.netAmount) || 0;
        const paidAmt = paidAmounts[Number(inv.voucherId)] || 0;
        const outstanding = Math.max(0, netAmt - paidAmt);
        return {
          ...inv,
          netAmount: netAmt,
          paidAmount: paidAmt,
          outstanding: Math.round(outstanding * 100) / 100,
          rateOfInterest: ledger ? Number(ledger.rateOfInterest || 0) : 0,
          creditDays: ledger ? Number(ledger.creditDays || 0) : 0,
        };
      })
      .filter((inv) => inv.outstanding > 0.01);

    return NextResponse.json(outstandingInvoices);
  }

  const conditions = [
    eq(tVouchers.companyId, companyId),
    eq(tVouchers.voucherType, type),
    isNull(tVouchers.deletedOn),
  ];

  if (partyId) {
    conditions.push(eq(tVouchers.partyId, Number(partyId)));
  }

  const query = db
    .select({
      voucherId: tVouchers.voucherId,
      voucherNo: tVouchers.voucherNo,
      voucherDate: tVouchers.voucherDate,
      voucherType: tVouchers.voucherType,
      status: tVouchers.status,
      totalAmount: tVouchers.totalAmount,
      taxAmount: tVouchers.taxAmount,
      netAmount: tVouchers.netAmount,
      remarks: tVouchers.remarks,
      partyId: tVouchers.partyId,
      billDetails: tVouchers.billDetails,
      broker: tVouchers.broker,
      haste: tVouchers.haste,
      lrNo: tVouchers.lrNo,
      lrDate: tVouchers.lrDate,
      transport: tVouchers.transport,
      vehicleNo: tVouchers.vehicleNo,
      personName: tVouchers.personName,
      lotNo: tVouchers.lotNo,
      parentVoucherId: tVouchers.parentVoucherId,
      cashBankLedgerId: tVouchers.cashBankLedgerId,
      bankName: tVouchers.bankName,
      paymentMethod: tVouchers.paymentMethod,
      discountType: tVouchers.discountType,
      discountValue: tVouchers.discountValue,
      discountType2: tVouchers.discountType2,
      discountValue2: tVouchers.discountValue2,
      extraCharges: tVouchers.extraCharges,
      extraChargesData: tVouchers.extraChargesData,
      partyName: mCompanies.companyName,
      partyGst: mCompanies.gstNo,
      partyAddress: mCompanies.address,
      jobName: mJobs.jobName,
      jobGst: mJobs.gstNo,
      jobAddress: mJobs.address,
      millName: mMills.millName,
      millGst: mMills.gstNo,
      millAddress: mMills.address,
    })
    .from(tVouchers)
    .leftJoin(mCompanies, eq(tVouchers.partyId, mCompanies.companyId))
    .leftJoin(mJobs, eq(tVouchers.partyId, mJobs.jobId))
    .leftJoin(mMills, eq(tVouchers.partyId, mMills.millId))
    .where(and(...conditions))
    .orderBy(desc(tVouchers.voucherDate), desc(tVouchers.voucherId));

  const vouchers = await query;

  if (includeItems && vouchers.length > 0) {
    const voucherIds = vouchers.map((v) => Number(v.voucherId));
    // Fetch items for these vouchers
    const items = await db
      .select({
        voucherItemId: tVoucherItems.voucherItemId,
        voucherId: tVoucherItems.voucherId,
        inventoryId: tVoucherItems.inventoryId,
        inventoryName: mInventory.inventoryName,
        inventoryCode: mInventory.inventoryCode,
        unit: mInventory.unit,
        ledgerId: tVoucherItems.ledgerId,
        ledgerName: mLedgers.ledgerName,
        hsnCode: tVoucherItems.hsnCode,
        pcs: tVoucherItems.pcs,
        quantity: tVoucherItems.quantity,
        fold: tVoucherItems.fold,
        rate: tVoucherItems.rate,
        gstRateId: tVoucherItems.gstRateId,
        taxableAmount: tVoucherItems.taxableAmount,
        cgst: tVoucherItems.cgst,
        sgst: tVoucherItems.sgst,
        igst: tVoucherItems.igst,
        netAmount: tVoucherItems.netAmount,
        pieceMeters: tVoucherItems.pieceMeters,
      })
      .from(tVoucherItems)
      .leftJoin(
        mInventory,
        eq(tVoucherItems.inventoryId, mInventory.inventoryId),
      )
      .leftJoin(
        mLedgers,
        eq(tVoucherItems.ledgerId, mLedgers.ledgerId),
      )
      .where(and(isNull(tVoucherItems.deletedOn)));

    const itemsGrouped = items.reduce((acc: any, item) => {
      const vId = Number(item.voucherId);
      if (!acc[vId]) acc[vId] = [];

      let parsedMeters = [];
      if (item.pieceMeters) {
        try {
          parsedMeters = JSON.parse(item.pieceMeters);
        } catch (e) {
          console.error("Error parsing piece_meters:", e);
        }
      }

      acc[vId].push({
        ...item,
        pieceMeters: parsedMeters,
      });
      return acc;
    }, {});

    const vouchersWithItems = vouchers.map((v) => ({
      ...v,
      lineItems: itemsGrouped[Number(v.voucherId)] || [],
    }));

    return NextResponse.json(vouchersWithItems);
  }

  return NextResponse.json(vouchers);
}
