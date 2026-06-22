from sqlalchemy import create_engine, MetaData
from config import DATABASE_URL

# database.py
# ponytail: SQLAlchemy Core engine and metadata setup. No DeclarativeBase/ORM to comply with Raw SQL & Core only rules.

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

metadata = MetaData()

def get_db():
    """Yields a database connection within a transaction context manager (commit on success, rollback on error)."""
    with engine.begin() as conn:
        yield conn
