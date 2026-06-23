<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Semantic Theme Colors Rules
- **Mandatory Colors Only**: ALWAYS use semantic classes (`bg-primary`, `text-secondary`, `border-success`, `text-muted-foreground`, etc.). Enforce this strictly for custom code, layouts, and pages.
- **Prohibited Colors**: DO NOT use hardcoded colors (`bg-blue-600`, `text-green-500`, `border-slate-200`, `dark:bg-zinc-900`, etc.).
- **Theme Variables**: Refrain from using other custom styling palettes. Stick strictly to: `primary`, `secondary`, `success`, `warning`, `info`, `danger`, `muted`, `background`, `foreground`, `card`, `border`, `input`.

# UI & UX Conventions
- **Labels**: Always uppercase, small size, and semi-bold; placed directly above inputs (never side-by-side).
- **Inputs**: Always use searchable selects instead of standard select. Use shadcn multi-select for associations.
- **Layout Flow**: Side-drawers (Sheets) for small configs. Full pages for voucher entry forms. Standard center dialog modals for destructive actions.
- **RBAC**: Hide actions (Create, Edit, Delete, Export, Approve) based on permissions. Route protection redirects unauthorized views to `/access-denied`.

# Backend & Database Standards
- **Routing**: API endpoints placed at `app/api/<feature>/route.ts`. Delegate database operations to service functions.
- **Drizzle ORM**: Construct queries with query builders. Wrap multi-table modifications inside `db.transaction`.
- **Database Naming**: Masters prefix `m_`, Transactions prefix `t_`, Auth mappings prefix `p_`.
- **Auditing**: Spreads `auditColumns` in all tables. Use soft-deletes (`deleted_on`, `deleted_by`) instead of hard deletion.
- **Multi-Tenant Security**: Lock queries based on `companyId` / `userId` in `auth()`.
- **Migrations**: Generate and apply DB edits exclusively through `drizzle-kit generate` and `drizzle-kit migrate`.
