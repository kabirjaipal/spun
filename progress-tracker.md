# Texora - Changes Progress Tracker

This document tracks our progress on the textile-specific enhancements defined in [changes-to-be-made.md](file:///media/kabir/Programming/Codes/Github-Projects/texora/changes-to-be-made.md).

---

## Progress Overview
- Total Steps: 12
- Completed Steps: 2/12 (16%)

---

## Detailed Task Checklist

### [x] 1. Company Modules & Market Category Support
- [x] Design foundation for company-specific workflows.
- [x] Main core accounting engine remains same, with settings/modules customized.

### [x] 2. Company Creation Details
- [x] Extended company creation inputs (Pincode, State, Phone, Email, Currency, Nation).
- [x] Support for GST applicability (GSTIN, State Code, City, Registration Type: Regular/Composition/Export).
- [x] Support for Bank account details (Bank name, account name, account number, IFSC code, branch, account type).
- [x] Simplified signup: User registers first with details, then completes full company registration at `/setup-company` page (avoiding duplicate entries).

### [ ] 3. Gateway & Masters Foundation
- [ ] Ledger Master
- [x] Group Master (default system groups auto-seeded during company creation)
- [ ] Inventory Master
- [ ] Job Master / Mill Master

### [x] 4. Account Ledger Master (Create / Alter Ledger)
- [x] Capture Short Name and Address
- [x] Select from Group (with inline new group creation support)
- [x] Capture GST number and PAN number
- [x] Capture MSME registration status (Micro, Small, Medium, Unregistered)
- [x] Capture Credit Days and Rate of Interest
- [x] Capture TDS applicability and TDS Rate %

### [ ] 5. Inventory Master (Groups, Categories, Units)
- [ ] Create/alter inventory groups
- [ ] Create/alter categories of inventory
- [ ] Create/alter units of measurement (PCS, MTR, KGS, GRM, LTR, BOX)

### [ ] 6. Creation of Inventory (Products)
- [ ] Capture Name, HSN code, Group, Categories
- [ ] Capture GST Type (state/center) and GST Percentage
- [ ] Capture Unit of Measurement
- [ ] Consumable or Selling goods selection (radio button)
- [ ] Consumption ratio (e.g. 1 meter cloth = 3 LTR color) & shortage percentage

### [ ] 7. Categories of Inventory
- [ ] Category master creation/alteration UI (Cloth, Color, Chemical, etc.)

### [ ] 8. Group of Inventory
- [ ] Group master creation/alteration UI (Consumable / Selling)

### [ ] 9. Unit of Measurement
- [ ] Unit master creation/alteration UI + default units validation

### [ ] 10. Job Master
- [ ] Party name, Address, GST No (auto-address), GST Type, City, State code, Phone, MSME status

### [ ] 11. Mill Master
- [ ] Mill name, Address, GST No, GST Type, City, State code, Phone, MSME status

### [ ] 12. Transactions & Vouchers
- [ ] **Purchase:**
  - [ ] Grey, Finished, Consumable, Other purchases
  - [ ] Interface fields (Party, invoice/sr number, broker, haste, LR details, transport)
  - [ ] Items table with fold calculation: `Quantity * Rate * fold / 100`
  - [ ] SGST, CGST, IGST totals
- [ ] **Purchase Return:**
  - [ ] Return against multiple purchase invoices
- [ ] **Job Work:**
  - [ ] Job Outward (Party, lot no, vehicle no, job type, job rate selection, etc.)
  - [ ] Job Inward (Shortage calculations, lot-wise matching)
- [ ] **Mill:**
  - [ ] Mill Outward (Quality, PCS, meter, rate, amount)
  - [ ] Mill Inward (Shortage matching outward-inward, lot status completion)
- [ ] **Sales:**
  - [ ] Grey, Finished, and Other sales layout with broker, haste, transport, items table and GST details
- [ ] **Payment & Receipt:**
  - [ ] Outstanding bill selection
  - [ ] Days and Interest calculations
  - [ ] Return cheque logs
- [ ] **Direct Bills & General Entries:**
  - [ ] Non-trading purchases (Goods, Service, Other)
  - [ ] General journal entries (Debit vs Credit with remarks)
- [ ] **Inventory Entries:**
  - [ ] Lot transfers between mills/jobs/parties
- [ ] **Debit / Credit Notes:**
  - [ ] Returns/adjustments against bills
