from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from backend.api.dependencies import get_db
from backend.core.config import settings
from backend.core.security import create_access_token, verify_password, get_password_hash
from backend.models.user import User
from backend.schemas.token import Token
from backend.schemas.user import UserCreate, UserRead

router = APIRouter()


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


@router.post("/token", response_model=Token)
def login_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> Token:
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(subject=user.email, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/register", response_model=UserRead)
def register(user_create: UserCreate, db: Session = Depends(get_db)) -> UserRead:
    existing_user = db.query(User).filter(User.email == user_create.email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    hashed_password = get_password_hash(user_create.password)
    user = User(email=user_create.email, full_name=user_create.full_name, hashed_password=hashed_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
