# Contributing to Spun

Thank you for your interest in contributing to Spun! As an open-source, self-hosted textile ERP and accounting platform, community contributions help make modern, reliable accounting software accessible to everyone.

---

## 🛠️ Development Setup

### Prerequisites

* **Node.js**: v20.x or higher
* **PostgreSQL**: v14+ or Docker
* **npm** / **pnpm** / **yarn**

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/spun.git
cd spun
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment template:

```bash
cp .env.example .env
```

Ensure `DATABASE_URL` points to your PostgreSQL instance. For local setups:
```env
DATABASE_URL="postgres://postgres:postgres@localhost:5432/spun"
AUTH_SECRET="dev-secret-key-32-chars-long"
```

### 4. Setup Database & Mock Data

Run database migrations and populate realistic seed data:

```bash
# Push or run migrations
npm run db:migrate

# Seed with full realistic textile ERP data (companies, masters, vouchers)
npm run db:realseed
```

### 5. Start the Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

**Default Login Credentials:**
* Email: `test@spun.app`
* Password: `password123`
* Company: Spun Trading Co.

---

## 📐 Coding & UI Standards

To maintain consistency and high performance across the ERP:

1. **Semantic Theme Colors**:
   * Always use semantic classes (`bg-primary`, `text-muted-foreground`, `border-border`).
   * Do **NOT** use hardcoded arbitrary colors (e.g., `bg-blue-600`, `text-[11px]`).
2. **Controls & Input Sizes**:
   * Use standard medium sizes (`h-9` / `h-10`, `text-sm`) for all inputs, selects, and buttons.
   * Avoid shrinking to `size="sm"` or `h-8` on main dashboard pages to ensure touch accessibility and readability.
3. **Database & Schema**:
   * Master tables are prefixed with `m_` (e.g., `m_users`, `m_parties`).
   * Transaction tables are prefixed with `t_` (e.g., `t_vouchers`, `t_voucher_entries`).
   * All tables must include audit columns (`created_on`, `created_by`, `updated_on`, `updated_by`).
   * Never physically delete records — use soft-deletes (`deleted_on`, `deleted_by`).
   * Multi-table writes must be wrapped inside `db.transaction`.
4. **shadcn Components**:
   * Do not create shadcn components by hand. Install them using `npx shadcn@latest add <component>`.

---

## 🚀 Submitting a Pull Request

1. Fork the repository and create your feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Commit your changes with a clear, conventional commit message:
   ```bash
   git commit -m "feat: add GST summary export in reports"
   ```
3. Push to your fork and submit a Pull Request against the `main` branch.
4. Describe the problem your PR solves and attach screenshots or test instructions.

---

## 📄 License

Spun is open-source software licensed under the [MIT License](LICENSE).
