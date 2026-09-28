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

    model_config = ConfigDict(
        from_attributes=True
    )


class PropertyIn(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=160
    )

    kind: str = Field(
        min_length=2,
        max_length=30
    )

    location: str = Field(
        min_length=2,
        max_length=180
    )

    capacity: int = Field(
        ge=1
    )

    price_per_day: float = Field(
        ge=0
    )

    image: str | None = None

    # Phone number customers should contact for
    # payment instructions or more information.
    contact_phone: str | None = Field(
        default=None,
        min_length=7,
        max_length=50
    )


class PropertyOut(PropertyIn):
    id: int
    owner_id: int | None = None

    model_config = ConfigDict(
        from_attributes=True
    )


class BookingIn(BaseModel):
    property_id: int

    customer_name: str = Field(
        min_length=2,
        max_length=160
    )

    customer_phone: str = Field(
        min_length=7,
        max_length=50
    )

    start_at: datetime
    end_at: datetime

    total_amount: float = Field(
        ge=0
    )

    deposit_amount: float = Field(
        ge=0
    )

    status: str = "confirmed"

    expires_at: datetime | None = None

    notes: str | None = None


class BookingOut(BookingIn):
    id: int
    customer_id: int | None = None

    model_config = ConfigDict(
        from_attributes=True
    )