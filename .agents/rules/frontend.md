# Frontend Rules & Architectural Guidelines

Always follow these rules strictly when implementing frontend pages, components, styles, or flows.

## 1. Technology Stack
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Component Library**: shadcn/ui
- **Multi-select Component**: Use shadcn multi-select component (`https://shadcn-multi-select-component.vercel.app/`).

---

## 2. Design System & Colors
Adhere to the color guidelines for UI consistency. Never use generic or unauthorized primary colors:
- **Primary (Blue)**: Use for primary buttons, active navigation states, links, and focus outlines.
- **Success (Green)**: Use for paid, received, approved, profit, and check states.
- **Warning (Amber)**: Use for pending, partial payment, attention, and warning states.
- **Danger (Red)**: Use for delete, overdue, loss, error states, and destructive buttons.
- **Info (Cyan)**: Use for help, tips, tooltips, and informational references.
- **Neutral (Slate)**: Use for tables, body text, borders, and general layouts/backgrounds.

---

## 3. Form Layout Standards
- **Label Alignment**: Always place the label directly above the input. Never side-by-side.
  *Correct Format:*
  ```text
  CUSTOMER NAME
  [Input Box]
  ```
  *Incorrect Format:*
  `Customer Name: [Input Box]`
- **Label Styling**: All labels must be:
  - Uppercase
  - Small size
  - Semi-bold

---

## 4. Selection & Input Components
- **Searchable Selects**: Always use a searchable select component. Do not use standard HTML selects.
- **shadcn Multi-Select**: Use this component specifically for choosing:
  - Customers / Suppliers
  - Products
  - Tax Rates
  - Ledgers
  - Roles / Users
  - Warehouses

---

## 5. Modal, Dialog, and Page Strategies
Different forms have strict layout placement standards:
- **Small Forms (Use Sheets/Drawers)**: Use side-drawers (Sheets) for small configs:
  - Customer / Supplier creation
  - Tax rate config
  - User / Role manager
- **Large Forms (Use Full Pages)**: Never place large entry forms in modals. Use full pages for:
  - Sales voucher entry
  - Purchase voucher entry
  - Receipt / Payment / Journal voucher entries
- **Confirmations (Always Modals)**: Always use standard center dialog modals for confirm states:
  - Deletions
  - Approvals
  - Cancellations / Reopen actions

---

## 6. Frontend Role-Based Access Control (RBAC)
Never expose actions the user is unauthorized to do. Filter buttons based on the user's permission parameters:
- `can_create == false` -> Hide Create buttons.
- `can_update == false` -> Hide Edit buttons.
- `can_delete == false` -> Hide Delete buttons.
- `can_export == false` -> Hide Export/Download actions.
- `can_approve == false` -> Hide Approve buttons.
- **Route Authorization**: If user does not have read access, immediately redirect to `/access-denied`.
