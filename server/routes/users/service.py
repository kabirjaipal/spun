from sqlalchemy import text
from sqlalchemy.engine import Connection
from routes.users import schemas
from fastapi import HTTPException, status

# routes/users/service.py
# ponytail: Raw SQL queries to comply with PRD. Upgrade path: use a query builder if SQL queries grow overly complex or dynamic.

def get_user_by_email(conn: Connection, email: str):
    query = text("""
        SELECT id, email, name 
        FROM m_users 
        WHERE email = :email AND deleted_on IS NULL
    """)
    result = conn.execute(query, {"email": email}).mappings().first()
    return result

def get_users(conn: Connection, skip: int = 0, limit: int = 100):
    query = text("""
        SELECT id, email, name 
        FROM m_users 
        WHERE deleted_on IS NULL 
        LIMIT :limit OFFSET :skip
    """)
    results = conn.execute(query, {"limit": limit, "skip": skip}).mappings().all()
    return results

def create_user(conn: Connection, user: schemas.UserCreate):
    # Business logic: check for existing email
    db_user = get_user_by_email(conn, user.email)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Email already registered"
        )
        
    hashed_password = f"hash_{user.password}"
    
    # Raw SQL insert using naming standard table m_users and audit fields from README.md
    query = text("""
        INSERT INTO m_users (
            email, 
            name, 
            password_hash, 
            created_on, 
            created_by, 
            updated_on, 
            updated_by
        )
        VALUES (
            :email, 
            :name, 
            :password_hash, 
            CURRENT_TIMESTAMP, 
            1, 
            CURRENT_TIMESTAMP, 
            1
        )
        RETURNING id, email, name
    """)
    
    result = conn.execute(query, {
        "email": user.email,
        "name": user.name,
        "password_hash": hashed_password
    }).mappings().first()
    
    return result
