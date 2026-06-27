# Texora - Changes Progress Tracker

This document tracks our progress on the textile-specific enhancements defined in [changes-to-be-made.md](file:///media/kabir/Programming/Codes/Github-Projects/texora/changes-to-be-made.md).

---

## Progress Overview
- Total Steps: 12
- Completed Steps: 11/12 (91%)

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

### [x] 3. Gateway & Masters Foundation
- [x] Ledger Master
- [x] Group Master (default system groups auto-seeded, and CRUD interface implemented)
- [x] Inventory Master
- [x] Job Master / Mill Master

### [x] 4. Account Ledger Master (Create / Alter Ledger)
- [x] Capture Short Name and Address
- [x] Select from Group (with inline new group creation support)
- [x] Capture GST number and PAN number
- [x] Capture MSME registration status (Micro, Small, Medium, Unregistered)
- [x] Capture Credit Days and Rate of Interest
- [x] Capture TDS applicability and TDS Rate %

### [x] 5. Inventory Master (Groups, Categories, Units)
- [x] Create/alter inventory groups
- [x] Create/alter categories of inventory
- [x] Create/alter units of measurement (PCS, MTR, KGS, GRM, LTR, BOX)

### [x] 6. Creation of Inventory (Products)
- [x] Capture Name, HSN code, Group, Categories
- [x] Capture GST Type (state/center) and GST Percentage
- [x] Capture Unit of Measurement
- [x] Consumable or Selling goods selection (radio button)
- [x] Consumption ratio (e.g. 1 meter cloth = 3 LTR color) & shortage percentage

### [x] 7. Categories of Inventory
- [x] Category master creation/alteration UI (Cloth, Color, Chemical, etc.)

### [x] 8. Group of Inventory
- [x] Group master creation/alteration UI (Consumable / Selling)

### [x] 9. Unit of Measurement
- [x] Unit master creation/alteration UI + default units validation

### [x] 10. Job Master
- [x] Party name, Address, GST No (auto-address), GST Type, City, State code, Phone, MSME status

### [x] 11. Mill Master
- [x] Mill name, Address, GST No, GST Type, City, State code, Phone, MSME status

### [ ] 12. Transactions & Vouchers
- [x] **Purchase:**
  - [x] Grey, Finished, Consumable, Other purchases
  - [x] Interface fields (Party, invoice/sr number, broker, haste, LR details, transport)
  - [x] Items table with fold calculation: `Quantity * Rate * fold / 100`
  - [x] SGST, CGST, IGST totals
- [x] **Purchase Return:**
  - [x] Return against multiple purchase invoices
- [ ] **Job Work:**
  - [x] Job Outward (Party, lot no, vehicle no, job type, job rate selection, etc.)
  - [x] Job Inward (Shortage calculations, lot-wise matching)
- [x] **Mill:**
  - [x] Mill Outward (Quality, PCS, meter, rate, amount)
  - [x] Mill Inward (Shortage matching outward-inward, lot status completion)
- [x] **Sales:**
  - [x] Grey, Finished, and Other sales layout with broker, haste, transport, items table and GST details
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
