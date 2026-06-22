# TextileERP MVP PRD & Architecture

## Vision

Build a modern cloud-based textile accounting ERP that feels familiar to Tally users while providing a cleaner UI, better navigation, faster workflows, and role-based access control.

Primary goal:

> A Tally user should be productive within minutes without training.

The system should preserve familiar accounting concepts while simplifying interaction.

---

# Technology Stack

## Frontend

* Next.js (App Router)
* TypeScript
* Tailwind CSS
* shadcn/ui
* shadcn multi-select component https://shadcn-multi-select-component.vercel.app/

## Backend

* FastAPI
* Python LTS
* SQLAlchemy Core only
* Raw SQL queries
* Alembic migrations

## Database

* PostgreSQL

## Storage

* S3-compatible object storage

---

# Naming Standards

## Tables

snake_case

Prefixes:

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

snake_case

Examples:

```text
customer_id
voucher_no
created_on
deleted_on
created_by
deleted_by
```

## Enums

snake_case

Examples:

```text
e_voucher_type
e_party_type
e_ledger_type
```

---

# Audit Fields

Every table must contain:

```sql
created_on timestamp
created_by bigint

updated_on timestamp
updated_by bigint

deleted_on timestamp null
deleted_by bigint null
```

Soft delete only.

Never physically delete:

```text
vouchers
voucher_entries
payments
receipts
stock_movements
```

---

# Role Based Access Control

## Access Table

### m_access

```sql
access_item varchar unique

page_url varchar
page_title varchar
page_icon varchar
page_group varchar

created_on
created_by
updated_on
updated_by
deleted_on
deleted_by
```

Examples:

```text
users
roles
customers
suppliers
products
sales
purchase
receipt
payment
ledger
reports
```

Owner-only examples:

```text
o_company_settings
o_billing
```

---

## Roles

### m_role

```sql
role_id bigint pk

role_name varchar

created_on
created_by
updated_on
updated_by
deleted_on
deleted_by
```

Examples:

```text
owner
admin
accountant
sales
inventory_manager
viewer
```

---

## User Role Mapping

### p_user_role

```sql
user_role_id bigint pk

user_id bigint
role_id bigint

created_on
created_by
updated_on
updated_by
deleted_on
deleted_by
```

---

## Role Permissions

### p_role_access

```sql
role_access_id bigint pk

role_id bigint
access_id bigint

c boolean
r boolean
u boolean
d boolean
e boolean
a boolean

created_on
created_by
updated_on
updated_by
deleted_on
deleted_by
```

---

# Authorization Rules

Frontend:

If:

```text
can_create = false
```

Hide create button.

If:

```text
can_update = false
```

Hide edit button.

If:

```text
can_delete = false
```

Hide delete button.

If:

```text
can_export = false
```

Hide export actions.

If:

```text
can_approve = false
```

Hide approve actions.

---

Backend:

Always validate permissions.

Never trust frontend.

---

Page middleware:

```text
User
 ↓
Role
 ↓
Role Access
 ↓
Page Access
```

No read access:

```text
redirect /access-denied
```

---

# UI Design System

## Colors

Primary

```text
Blue
```

Use for:

```text
primary buttons
active navigation
links
focus states
```

Success

```text
Green
```

Use for:

```text
paid
received
approved
profit
```

Warning

```text
Amber
```

Use for:

```text
pending
partial payment
attention
```

Danger

```text
Red
```

Use for:

```text
delete
overdue
loss
errors
```

Info

```text
Cyan
```

Use for:

```text
help
tips
references
```

Neutral

```text
Slate
```

Use for:

```text
tables
text
borders
backgrounds
```

---

# Form Design Standard

Always:

```text
LABEL

[input]
```

Example:

```text
CUSTOMER NAME

[ABC Textiles]
```

Never:

```text
Customer Name: [ABC]
```

All labels:

```text
uppercase
small
semi-bold
```

---

# Select Components

Use searchable select everywhere.

Use:

* shadcn multi-select component

For:

```text
customer
supplier
product
tax
ledger
roles
users
warehouses
```

---

# Modal Standards

## Small Forms

Use Sheet

Examples:

```text
customer
supplier
tax rate
user
role
```

---

## Large Forms

Use Full Page

Examples:

```text
sales voucher
purchase voucher
receipt voucher
payment voucher
journal voucher
```

---

## Confirmations

Always Modal

Examples:

```text
delete
approve
cancel
reopen
```

---

# Sidebar

## Dashboard

```text
dashboard
```

---

## Masters

```text
customers
suppliers
products
ledgers
tax rates
warehouses
```

---

## Transactions

```text
sales
purchase
receipt
payment
journal
```

---

## Inventory

```text
stock items
stock summary
stock movements
```

---

## Reports

```text
ledger
trial balance
profit and loss
balance sheet
gst reports
```

---

## Administration

```text
users
roles
permissions
company settings
```

---

# Core Database Structure

## Companies

### m_companies

```sql
company_id bigint pk

company_name varchar
gst_no varchar
pan_no varchar

address text

financial_year_start date

created_on
created_by
updated_on
updated_by
deleted_on
deleted_by
```

---

## Users

### m_users

```sql
user_id bigint pk

full_name varchar

email varchar

password_hash text

is_active boolean

company_id bigint

created_on
created_by
updated_on
updated_by
deleted_on
deleted_by
```

---

## Customers

### m_customers

```sql
customer_id bigint pk

company_id bigint

customer_name varchar

gst_no varchar

phone varchar

email varchar

address text

opening_balance numeric

created_on
created_by
updated_on
updated_by
deleted_on
deleted_by
```

---

## Suppliers

### m_suppliers

```sql
supplier_id bigint pk

company_id bigint

supplier_name varchar

gst_no varchar

phone varchar

email varchar

address text

opening_balance numeric

created_on
created_by
updated_on
updated_by
deleted_on
deleted_by
```

---

## Products

### m_products

```sql
product_id bigint pk

company_id bigint

product_code varchar

product_name varchar

unit varchar

gst_rate_id bigint

opening_stock_qty numeric

opening_stock_rate numeric

created_on
created_by
updated_on
updated_by
deleted_on
deleted_by
```

---

## Tax Rates

### m_tax_rates

```sql
tax_rate_id bigint pk

tax_name varchar

tax_percent numeric

created_on
created_by
updated_on
updated_by
deleted_on
deleted_by
```

---

# Accounting Engine

## Ledgers

### m_ledgers

```sql
ledger_id bigint pk

company_id bigint

ledger_name varchar

ledger_type varchar

reference_id bigint

created_on
created_by
updated_on
updated_by
deleted_on
deleted_by
```

Examples:

```text
cash
bank
customer
supplier
sales
purchase
tax
expense
```

---

# Voucher System

## Vouchers

### t_vouchers

```sql
voucher_id bigint pk

company_id bigint

voucher_no varchar

voucher_type varchar

voucher_date date

party_id bigint

remarks text

status varchar

total_amount numeric

tax_amount numeric

net_amount numeric

created_on
created_by
updated_on
updated_by
deleted_on
deleted_by
```

Voucher Types:

```text
sale
purchase
receipt
payment
journal
```

---

## Voucher Entries

### t_voucher_entries

```sql
voucher_entry_id bigint pk

voucher_id bigint

ledger_id bigint

entry_type varchar

amount numeric

created_on
created_by
updated_on
updated_by
deleted_on
deleted_by
```

Entry Types:

```text
debit
credit
```

---

# Inventory

## Stock Movements

### t_stock_movements

```sql
stock_movement_id bigint pk

company_id bigint

product_id bigint

voucher_id bigint

movement_type varchar

quantity numeric

rate numeric

amount numeric

created_on
created_by
updated_on
updated_by
deleted_on
deleted_by
```

Movement Types:

```text
purchase
sale
adjustment
opening
```

---

# Audit System

## Audit Log

### t_audit_log

```sql
audit_log_id bigint pk

table_name varchar

record_id bigint

action_type varchar

old_data_json jsonb

new_data_json jsonb

created_on
created_by
```

Action Types:

```text
create
update
delete
approve
```

---

# SQLAlchemy Strategy

No ORM models.

Use:

```python
engine
session
text()
```

Pattern:

```python
with engine.begin() as conn:
    conn.execute(
        text("""
        select *
        from m_customers
        where deleted_on is null
        """)
    )
```

Use transactions for:

```text
sales voucher save
purchase voucher save
receipt save
payment save
```

Everything commits together.

---

# Migration Strategy

Use Alembic.

Structure:

```text
backend/

migrations/

versions/

0001_initial.py
0002_roles.py
0003_inventory.py
0004_vouchers.py
```

Rules:

* Never edit old migration
* Only add new migrations
* Every release gets migration
* Migration history must remain immutable

---

# Development Phases

## Phase 1

Authentication

Users

Roles

Permissions

Companies

---

## Phase 2

Customers

Suppliers

Products

Tax Rates

Ledgers

---

## Phase 3

Sales Voucher

Purchase Voucher

Receipt Voucher

Payment Voucher

Journal Voucher

---

## Phase 4

Stock Movements

Stock Summary

Inventory Reports

---

## Phase 5

Ledger Report

Trial Balance

Profit & Loss

Balance Sheet

GST Reports

---

## Phase 6

Audit Logs

Exports

Print Templates

Dashboard Analytics

---

# Product Principle

Keep Tally's mental model.

Modernize:

* navigation
* search
* forms
* permissions
* reports
* usability

Do not change accounting concepts.

The user should feel:

"I already know how this works."
