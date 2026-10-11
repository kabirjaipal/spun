<div align="center">

# 🧵 Spun (TextileERP)

**Modern, Open-Source & Self-Hosted Accounting & ERP for Textile Businesses**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-PostgreSQL-green)](https://orm.drizzle.team/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

*Tally-familiar speed and accounting workflows meet a modern, responsive web application.*

[Features](#-key-features) • [Self-Hosting with Docker](#-self-hosting-with-docker) • [Local Development](#-local-development) • [Environment Variables](#%EF%B8%8F-environment-variables) • [Architecture](#-architecture) • [Contributing](#-contributing)

</div>

---

## 💡 Why Spun?

Traditional desktop accounting tools like Tally are powerful and fast, but they tie businesses to local machines, complex networks, and outdated user experiences.

**Spun** gives textile traders, weavers, mills, and manufacturers the best of both worlds:
1. **Preserved Accounting Mental Model**: Double-entry bookkeeping, debit/credit journal vouchers, party accounts, and ledger groups that every accountant already understands.
2. **Modern Web Experience**: Instant searchable dropdowns, keyboard-friendly entries, clean responsive UI, and role-based access control.
3. **100% Data Ownership**: Completely open-source and self-hosted. Run it on your own server, Docker container, or local network with zero vendor lock-in or subscription fees.

---

## ✨ Key Features

### 📑 Accounting & Vouchers
- **Complete Voucher Engine**: Sales, Purchases, Sales Return, Purchase Return, Direct Bills.
- **Financial Transactions**: Receipts, Payments, Debit Notes, Credit Notes, and multi-ledger Journal Entries.
- **Double-Entry Balance Validation**: Real-time balancing checks with automated ledger entries.

### 🏭 Textile & Manufacturing Operations
- **Mill Workflows**: Mill Inward and Mill Outward lot tracking.
- **Job Work Management**: Job Inward and Job Outward processing steps.
- **Lot Transfers & Inventory**: Real-time stock movement tracking across gray, processed, and finished yarn/fabrics.

### 🗂️ Master Records
- **Parties & Ledgers**: Customers, Suppliers, Brokers/Haste, Chart of Accounts, Parent Ledger Groups.
- **Tax Configuration**: GST rates (CGST/SGST/IGST), states, and optional automated GSTIN lookup.
- **Units & Currencies**: Flexible measurement units (MTR, KGS, PCS, etc.) and global currency support.

### 📊 Real-Time Financial Reports
- **Day Book**: Filterable day-by-day record of all operational vouchers.
- **Ledger Statements**: Detailed debits, credits, running balances, and voucher drill-downs.
- **Outstanding Balances**: Group-wise accounts receivable and accounts payable.
- **Cash & Bank Summaries**: Cash flow positions across all bank and cash accounts.

### 🛡️ Security & Multi-Tenancy
- **Granular RBAC**: Control Create, Read, Update, Delete (soft-delete), Export, and Approve permissions per role.
- **Multi-Company Context**: Manage multiple branches or legal entities under a single installation.

---

## 🐳 Self-Hosting with Docker

You can launch Spun and a PostgreSQL database in seconds with Docker Compose.

### 1. Clone & Configure

```bash
git clone https://github.com/your-username/spun.git
cd spun
cp .env.example .env
```

Edit `.env` and set a random production secret:
```bash
# Generate a secret:
openssl rand -hex 32
```
Update `AUTH_SECRET="<your-generated-secret>"` in `.env`.

### 2. Start Containers

```bash
docker compose up -d
```

### 3. Apply Migrations & Seed (First Time Only)

```bash
# Run migrations inside the web container
docker compose exec web npx drizzle-kit migrate

# (Optional) Seed realistic demo data
docker compose exec web npx tsx --env-file=.env lib/db/real_seed.ts
```

Open **`http://localhost:3000`** in your browser.

---

## 💻 Local Development

### Prerequisites
* **Node.js** 20.x or higher
* **PostgreSQL** 14+ running locally or in Docker
* **npm** or **pnpm**

### Step-by-Step Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/spun.git
   cd spun
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   Ensure `DATABASE_URL` in `.env` points to your PostgreSQL database:
   ```env
   DATABASE_URL="postgres://postgres:postgres@localhost:5432/spun"
   AUTH_SECRET="any-development-secret-key-32-chars-long"
   ```

4. **Initialize database & seed data**:
   ```bash
   # Run schema migrations
   npm run db:migrate

   # Populate full realistic textile company & transactions
   npm run db:realseed
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

Navigate to `http://localhost:3000`.

### 🔑 Demo Login Credentials

The realistic seed script populates sample companies and users:

| Email | Password | Role / Company |
|---|---|---|
| `test@spun.app` | `password123` | **Spun Trading Co.** (Full ERP Demo) |
| `owner@spun.app` | `password123` | **Owner** (Multi-Company Setup) |

---

## ⚙️ Environment Variables

| Variable | Required | Description | Default |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string | `postgres://postgres:postgres@localhost:5432/spun` |
| `AUTH_SECRET` | **Yes** | Session & JWT encryption secret | *(Required in production)* |
| `NEXT_PUBLIC_APP_URL` | No | Canonical web application URL | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | No | Google OAuth App Client ID | `""` *(Disabled if empty)* |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth App Secret | `""` *(Disabled if empty)* |
| `GSTINCHECK_API_KEY` | No | Optional API key for GSTIN lookup | `""` *(Optional)* |

---

## 📐 Architecture & Database Design

Spun adheres to clean architectural principles for accounting integrity:
* **Audit Columns**: Every table tracks `created_on`, `created_by`, `updated_on`, and `updated_by`.
* **Soft Deletes**: Deletions are non-destructive (`deleted_on`, `deleted_by`) to ensure financial auditability.
* **Database Transactions**: Multi-table updates and double-entry adjustments run inside ACID `db.transaction`.
* **Table Naming Standards**:
  - `m_*`: Master data tables (e.g. `m_users`, `m_companies`, `m_parties`, `m_ledgers`).
  - `t_*`: Transaction & operational tables (e.g. `t_vouchers`, `t_voucher_entries`, `t_stock_movements`).
  - `p_*`: Permission & mapping tables (e.g. `p_user_role`, `p_role_access`).

For a deep dive into the schema definitions and technical PRD, see **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

---

## 🤝 Contributing

Contributions from the open-source community are warmly welcomed! Whether you want to add new reports, print templates, e-invoicing integrations, or improve documentation:

1. Read our **[CONTRIBUTING.md](CONTRIBUTING.md)** guidelines.
2. Fork the repository and create a feature branch (`feat/awesome-feature`).
3. Submit a Pull Request.

---

## 📜 License

Spun is free, open-source software licensed under the **[MIT License](LICENSE)**.
