import os

# config.py
# ponytail: simple os.environ settings instead of heavy pydantic-settings. Upgrade path: pydantic-settings if complex type coercion is needed.

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
APP_ENV = os.getenv("APP_ENV", "development")
PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")
