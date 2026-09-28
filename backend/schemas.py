from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LoginIn(BaseModel):
    email: str
    password: str


class RegisterIn(BaseModel):
    email: str
    password: str = Field(min_length=8)
    confirm_password: str = Field(min_length=8)
    role: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str
    role: str

    model_config = ConfigDict(from_attributes=True)


class PropertyIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    kind: str
    location: str
    capacity: int = Field(ge=1)
    price_per_day: float = Field(ge=0)
    image: str | None = None


class PropertyOut(PropertyIn):
    id: int

    model_config = ConfigDict(from_attributes=True)


class BookingIn(BaseModel):
    property_id: int
    customer_name: str
    customer_phone: str
    start_at: datetime
    end_at: datetime
    total_amount: float = Field(ge=0)
    deposit_amount: float = Field(ge=0)
    status: str = "confirmed"
    expires_at: datetime | None = None
    notes: str | None = None


class BookingOut(BookingIn):
    id: int

    model_config = ConfigDict(from_attributes=True)
