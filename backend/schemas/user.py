from pydantic import BaseModel, EmailStr, ConfigDict


class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = None


class UserCreate(UserBase):
    password: str


class UserRead(UserBase):
    id: int
    is_active: bool
    is_superuser: bool

    model_config = ConfigDict(from_attributes=True)

