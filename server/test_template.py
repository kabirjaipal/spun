from main import app

# test_template.py
# ponytail: assert-based self-check to verify autoloader logic. No test frameworks or fixtures required.

def get_all_paths(routes, prefix=""):
    paths = []
    for r in routes:
        if type(r).__name__ == "_IncludedRouter":
            inc_prefix = getattr(r.include_context, "prefix", "")
            paths.extend(get_all_paths(r.original_router.routes, prefix + inc_prefix))
        elif hasattr(r, 'path'):
            paths.append(prefix + r.path)
    return paths

def test_routes_loaded():
    paths = get_all_paths(app.routes)
    print("Found paths recursively:", paths)
    
    # Assert HTTP users routes are registered
    assert any(p.startswith("/api/users") for p in paths), "HTTP users router not registered under /api!"
    
    # Assert WebSocket route is registered
    assert "/ws/chat" in paths, "WebSocket chat router not registered!"
    
    # Assert root route is registered
    assert "/" in paths, "Root router not registered!"
    
    print("Verification complete: Autoloader logic successfully verified!")

def test_user_operations():
    from database import engine
    from routes.users import service, schemas
    from fastapi import HTTPException
    from sqlalchemy import text

    with engine.begin() as conn:
        # Delete user if exists to ensure test is clean
        conn.execute(text("DELETE FROM m_users WHERE email = :email"), {"email": "test@example.com"})

        # 1. Create a user
        user_in = schemas.UserCreate(email="test@example.com", name="Test User", password="securepassword")
        user_out = service.create_user(conn, user_in)
        assert user_out is not None, "Failed to create user!"
        assert user_out["email"] == "test@example.com"
        assert user_out["name"] == "Test User"
        assert "id" in user_out
        
        # 2. Get user by email
        user_fetched = service.get_user_by_email(conn, "test@example.com")
        assert user_fetched is not None
        assert user_fetched["email"] == "test@example.com"

        # 3. Create duplicate user (must raise HTTPException 400)
        try:
            service.create_user(conn, user_in)
            assert False, "Should have raised HTTPException for duplicate email"
        except HTTPException as e:
            assert e.status_code == 400
            
    print("Verification complete: User CRUD & raw SQL operations successfully verified!")

if __name__ == "__main__":
    test_routes_loaded()
    test_user_operations()
