# Project Context

We started by researching whether there is a true cloud-based "Tally for Textile Industry" product.

The conclusion was:

* Textile ERPs exist.
* Tally exists.
* There is still a gap between them.
* Most textile businesses use Tally + Excel + manual processes.
* Many textile ERPs are powerful but complex.
* Most accounting systems are simple but not textile-aware.

The product goal is NOT to replace every ERP feature.

The goal is:

"Build a modern cloud-native accounting ERP that feels familiar to Tally users but is significantly easier to use."

---

# Understanding Tally

Before planning the software, we spent time understanding how Tally works from first principles.

Key learnings:

* A business is just money, stock, customers, and suppliers.
* Accounting is recording business events.
* A ledger is simply a history page for one thing.
* Tally stores transactions and generates reports from them.
* Every business event updates multiple ledgers.
* The center of the system is the transaction/voucher.
* Reports are derived from voucher entries.

Important realization:

Tally users do not think in terms of databases.

They think in terms of:

* Sales
* Purchase
* Receipt
* Payment
* Stock
* Customers
* Suppliers

The software should expose business concepts first and accounting concepts second.

---

# Product Philosophy

Do not try to reinvent accounting.

Do not try to teach users a new workflow.

Keep the mental model that Tally users already know.

Modernize:

* Navigation
* Search
* Form design
* Permissions
* Reporting UX
* Speed

The user should feel:

"I already know how to use this."

---

# Target User

Primary target:

* Small and medium textile businesses
* Fabric traders
* Textile wholesalers
* Businesses currently using Tally

Not targeting:

* Large enterprise ERP customers
* Complex manufacturing workflows in MVP

---

# UX Philosophy

The biggest mistake would be making the software look modern but forcing users to learn a new system.

The software should be modern visually but familiar operationally.

Examples:

* Keep Sales, Purchase, Receipt, Payment terminology.
* Keep accounting concepts available.
* Reduce clicks.
* Improve search.
* Improve data entry speed.

Tally users value speed more than visual effects.

---

# Architecture Philosophy

The accounting engine is the foundation.

Everything else sits on top of it.

Mental model:

Business Action
↓
Voucher
↓
Voucher Entries
↓
Ledger Impact
↓
Reports

Customers, suppliers, products, stock, and taxes are supporting entities around the voucher system.

---

# Database Philosophy

We decided to avoid heavy ORM usage.

Reasons:

* ERP systems are query-heavy.
* Reporting is query-heavy.
* Accounting systems need predictable SQL.
* Performance and control matter more than ORM convenience.

Use:

* SQLAlchemy Core
* Raw SQL
* Explicit transactions
* PostgreSQL

The database should be treated as a first-class part of the application.

---

# Security Philosophy

Role-based access is a core feature, not an afterthought.

Requirements:

* Page-level access
* Action-level access
* Backend validation
* Frontend visibility control

If a user cannot perform an action:

* Hide the button
* Block the API
* Redirect unauthorized page access

---

# Audit Philosophy

Accounting software must always answer:

"Who changed what and when?"

Auditability is a core requirement.

Important records should never be physically deleted.

Use soft deletes and audit logs from the beginning.

---

# Design Philosophy

The UI should communicate trust.

Avoid startup-style flashy design.

Prefer:

* Blue primary actions
* Clean tables
* Dense information layouts
* Professional accounting software appearance

The software should feel closer to banking software than a marketing website.

---

# Long-Term Vision

Start with:

* Accounting
* Inventory
* Textile trading workflow

After adoption:

* Better inventory
* Textile-specific features
* Reporting
* Automation
* AI-assisted accounting

But the MVP focus remains:

"A modern, easier-to-use Tally-like cloud ERP for textile businesses."
