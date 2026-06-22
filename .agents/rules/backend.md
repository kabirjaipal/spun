# Backend Rules & Architectural Guidelines

Always follow these rules strictly when implementing new backend features, database updates, API routes, or background tasks.

## 1. File Placement & Directory Layout
When implementing new features, place files in the appropriate directories to ensure automatic loading:
- **HTTP Endpoints**: Place under `routes/<feature>/` in files named `router.py`, `schemas.py`, and `service.py`. The router will be automatically loaded and registered.
- **WebSocket Routers**: Place under `sockets/<module>.py`. The socket router will be automatically registered.
- **Background Tasks**: Place under `schedulers/<module>.py` and define an `async def start()` function. It will be automatically executed in the background event loop.
- **Middlewares**: Custom HTTP middlewares go in `middlewares/`.
- **Shared Helpers**: General utilities go in `lib/`.

---

## 2. FastAPI Router Design (Strict Separation)
- **Zero Logic in Routers**: Router files (`router.py`) must only define API endpoints, paths, tags, security/dependencies, and delegate the execution to `service.py` functions immediately.
- **No HTTPExceptions in Routers**: Any validation error checking, database checks, duplicate detection, and raising of `HTTPException` must occur in the service file.

---

## 3. Database Layer (SQLAlchemy Core & Raw SQL)
- **SQLAlchemy Core Only**: Do not use SQLAlchemy ORM models (`Base` models map to database rows).
- **Raw SQL Queries**: Execute queries using raw SQL string statements wrapped in SQLAlchemy's `text()` construct:
  ```python
  from sqlalchemy import text
  query = text("SELECT id, email FROM m_users WHERE id = :id")
  result = conn.execute(query, {"id": user_id}).mappings().first()
  ```
- **Explicit Transactions**: Connections are retrieved from the `get_db` dependency which wraps an `engine.begin()` block, automatically committing on success or rolling back on error.

---

## 4. Schemas & Data Validation
- All inputs and outputs must be validated using Pydantic models defined inside `schemas.py` files.
- Service functions must accept these schema objects directly for validation, keeping data type signatures clean.

---

## 5. Table Naming & Audit Standards
- **Naming Prefix**:
  - Master tables: `m_` (e.g., `m_users`).
  - Transaction tables: `t_` (e.g., `t_vouchers`).
  - Permission mapping tables: `p_` (e.g., `p_user_role`).
- **Audit Columns**: Every table must contain the following columns:
  ```sql
  created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT,
  updated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT,
  deleted_on TIMESTAMP NULL,
  deleted_by BIGINT NULL
  ```
- **Soft Deletes**: Never delete rows physically from master or transaction tables. Always apply soft-deletes via the `deleted_on` and `deleted_by` fields.

---

## 6. Migration Strategy (Alembic)
- Use **Alembic** under `server/migrations/` for schema management.
- Do not run `Base.metadata.create_all` in application startup code.
- Migration files must remain immutable. Keep the sequential numbering format for version filenames (e.g. `0001_initial.py`, `0002_roles.py`).
- Apply migrations using `uv run alembic upgrade head`.

---

## 7. Package and Command Executions
- Always use the **`uv`** package manager toolchain for commands:
  - Run scripts: `uv run python script.py`
  - Install dependencies: `uv pip install <package>`
  - Run development server: `uv run uvicorn main:app --reload`
