# Backend Rules & Architectural Guidelines (Next.js & Drizzle ORM)

Always follow these rules strictly when implementing new backend features, database schemas, API routes, or auth logic.

## 1. File Placement & Directory Layout
When implementing backend logic in Next.js App Router:
- **API Endpoints**: Place under `app/api/<feature>/route.ts` (e.g. `app/api/users/route.ts`).
- **Database Schema**: All table definitions must be inside `lib/db/schema.ts`.
- **Database Connection**: Configured in `lib/db/index.ts`.
- **Authentication**: Core setup is in `auth.ts` at the root.

---

## 2. API Route & Server Actions Design (Strict Separation)
- **Zero Business Logic in Routes/Actions**: Route handlers (`route.ts`) and Server Actions must validate input (using Zod or standard types), delegate the actual data logic to a dedicated service function, and return the response.
- **Error Handling**: Catch database or runtime exceptions and return standard HTTP JSON responses (e.g., `NextResponse.json({ error: "Message" }, { status: 400 })`).

---

## 3. Database Layer (Drizzle ORM & node-postgres)
- **Drizzle ORM**: Use Drizzle ORM to build queries. Avoid writing plain raw SQL strings unless specifically required for performance reasons.
- **Transactions**: For operations that impact multiple tables (like saving a Sales Voucher and writing its Voucher Entries), use `db.transaction(async (tx) => { ... })` to ensure atomic updates.
- **Database Instance**: Import `db` from `@/lib/db`.

---

## 4. Table Naming & Audit Standards
- **Naming Prefix**:
  - Master tables: `m_` (e.g., `m_users`, `m_companies`).
  - Transaction tables: `t_` (e.g., `t_vouchers`).
  - Permission/Session/Auth mapping tables: `p_` (e.g., `p_accounts`, `p_sessions`).
- **Audit Columns**: Custom tables must spread the `auditColumns` helper in `schema.ts`:
  ```typescript
  created_on: timestamp("created_on").defaultNow().notNull(),
  created_by: bigint("created_by", { mode: "bigint" }),
  updated_on: timestamp("updated_on").defaultNow().notNull(),
  updated_by: bigint("updated_by", { mode: "bigint" }),
  deleted_on: timestamp("deleted_on"),
  deleted_by: bigint("deleted_by", { mode: "bigint" })
  ```
- **Soft Deletes**: Never physically delete rows from master or transaction tables. Apply soft-deletes by setting `deleted_on` and `deleted_by`.

---

## 5. Migration Strategy (Drizzle Kit)
- Do not run manual schema syncs or direct database structural edits.
- Use **Drizzle Kit** to manage PostgreSQL database migrations:
  1. Generate migrations: `npx drizzle-kit generate` (saved under `./drizzle/`).
  2. Push/migrate: `npx drizzle-kit migrate` (or `npx drizzle-kit push` for dev syncs).
- All migrations must be version controlled and immutable.

---

## 6. Authentication & Middleware (NextAuth.js)
- Always protect sensitive API routes by running `const session = await auth();` at the beginning of the route handler.
- If `!session`, return a `401 Unauthorized` response.
- Control database operations by scoping queries with `session.user.id` or `session.user.companyId` to ensure multi-tenant security.
