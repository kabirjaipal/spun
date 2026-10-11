# TextileERP Architecture & Domain Model Specification

## Vision

Build a modern cloud-based textile accounting ERP that feels familiar to Tally users while providing a cleaner UI, better navigation, faster workflows, and role-based access control.

Primary goal:

> A Tally user should be productive within minutes without training.

The system preserves familiar accounting concepts while simplifying interaction.

---

# Technology Stack

## Frontend & Backend
* Next.js (App Router)
* TypeScript
* Tailwind CSS
* shadcn/ui
* NextAuth.js (Auth.js) for authentication

## Database & ORM
* PostgreSQL
* Drizzle ORM
* Drizzle Kit migrations

## Storage
* S3-compatible object storage

---

# Naming Standards

## Tables

`snake_case`

Master tables:
```text
m_users
m_companies
m_customers
m_suppliers
m_products
m_ledgers
m_tax_rates
m_access
```

Permission tables:
```text
m_role
p_user_role
p_role_access
```

Transaction tables:
```text
t_vouchers
t_voucher_entries
t_stock_movements
t_audit_log
```

## Columns

`snake_case` (e.g. `customer_id`, `voucher_no`, `created_on`, `deleted_on`, `created_by`, `deleted_by`)

## Enums

`snake_case` (e.g. `e_voucher_type`, `e_party_type`, `e_ledger_type`)

---

# Audit Fields

Every table contains:
```sql
created_on timestamp
created_by bigint

updated_on timestamp
updated_by bigint

deleted_on timestamp null
deleted_by bigint null
```

Soft delete only. Never physically delete records from operational tables.

---

# Role Based Access Control (RBAC)

## Access Items (`m_access`)
* Users, Roles, Permissions
* Customers, Suppliers, Products
* Sales, Purchase, Receipts, Payments
* Ledgers, Reports, Settings

## Role Permissions (`p_role_access`)
Granular permissions per role and module:
* `c`: Create
* `r`: Read
* `u`: Update / Edit
* `d`: Delete (Soft delete)
* `e`: Export (CSV / Excel)
* `a`: Approve

---

# UI Design System & Form Standards

* **Semantic Colors**: Always semantic classes (`bg-primary`, `text-secondary`, `border-border`).
* **Form Inputs**: Always uppercase, small, semi-bold labels placed directly above searchable inputs.
* **Sizing**: Default medium control heights (`h-9` / `h-10`, `text-sm`) for readability and ergonomics.
* **Layout Flow**: Side-drawers (Sheets) for small master forms; full pages for complex voucher entries; centered modals for confirmations.

---

# Core Database Structure

## Companies (`m_companies`)
* Multi-tenant context and fiscal year configuration (`financial_year_start`).

## Ledgers & Accounting Engine (`m_ledgers`)
* Double-entry bookkeeping with parent-child ledger hierarchy and automatic balancing.

## Vouchers (`t_vouchers` & `t_voucher_entries`)
* Vouchers types: `sale`, `purchase`, `receipt`, `payment`, `journal`, `sales_return`, `purchase_return`, `direct_bill`.
* Entry types: `debit`, `credit`.

## Inventory Movements (`t_stock_movements`)
* Traceable lot, mill, and processing movements: `purchase`, `sale`, `adjustment`, `job_inward`, `job_outward`, `mill_inward`, `mill_outward`.

---

# Drizzle ORM Strategy

All schemas reside in `lib/db/schema.ts`. Migrations are generated and tracked in `drizzle/` via `drizzle-kit`.
Multi-table modifications are wrapped within `db.transaction`.
