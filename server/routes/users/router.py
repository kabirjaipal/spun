from fastapi import APIRouter, Depends, status
from sqlalchemy.engine import Connection
from database import get_db
from routes.users import schemas, service

# routes/users/router.py

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def create_user(user: schemas.UserCreate, db: Connection = Depends(get_db)):
    return service.create_user(conn=db, user=user)

@router.get("/", response_model=list[schemas.User])
def read_users(skip: int = 0, limit: int = 100, db: Connection = Depends(get_db)):
    return service.get_users(conn=db, skip=skip, limit=limit)
