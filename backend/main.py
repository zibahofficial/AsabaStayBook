import os

from datetime import datetime, timezone
from decimal import Decimal

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import User, Property, Booking
from .schemas import (
    LoginIn,
    RegisterIn,
    Token,
    UserOut,
    PropertyIn,
    PropertyOut,
    BookingIn,
    BookingOut,
)
from .auth import (
    verify_password,
    hash_password,
    make_token,
    current_user,
)


# =========================================================
# DATABASE
# =========================================================

Base.metadata.create_all(engine)


def ensure_property_contact_phone_column():
    """
    Adds the contact_phone column to an existing properties table
    if the column does not already exist.

    This is needed because SQLAlchemy create_all() does not modify
    an existing table when a new column is added to the model.
    """

    inspector = inspect(engine)

    if "properties" not in inspector.get_table_names():
        return

    columns = inspector.get_columns("properties")

    existing_columns = {
        column["name"]
        for column in columns
    }

    if "contact_phone" not in existing_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE properties "
                    "ADD COLUMN contact_phone VARCHAR(50)"
                )
            )


ensure_property_contact_phone_column()


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="AsabaStayBook API",
    version="1.0.0",
)


# =========================================================
# CORS
# =========================================================

origins = [
    x.strip()
    for x in os.getenv(
        "CORS_ORIGINS",
        "http://127.0.0.1:5500,http://localhost:5500",
    ).split(",")
    if x.strip()
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# STATIC FILES
# =========================================================

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

app.mount(
    "/css",
    StaticFiles(directory=FRONTEND_DIR / "css"),
    name="css",
)

app.mount(
    "/js",
    StaticFiles(directory=FRONTEND_DIR / "js"),
    name="js",
)

app.mount(
    "/assets",
    StaticFiles(directory=FRONTEND_DIR / "assets"),
    name="assets",
)



# =========================================================
# BOOKING EXPIRY
# =========================================================

def expire_pending(db: Session):
    now = (
        datetime.now(timezone.utc)
        .replace(tzinfo=None)
    )

    rows = (
        db.query(Booking)
        .filter(
            Booking.status == "pending",
            Booking.expires_at.isnot(None),
            Booking.expires_at < now,
        )
        .all()
    )

    for booking in rows:
        booking.status = "expired"

    if rows:
        db.commit()


# =========================================================
# HEALTH
# =========================================================

@app.get("/api/health")
def health():
    return {"status": "ok"}


# =========================================================
# AUTHENTICATION
# =========================================================

@app.post(
    "/api/auth/register",
    response_model=Token,
)
def register(
    data: RegisterIn,
    db: Session = Depends(get_db),
):
    email = data.email.lower().strip()

    if data.password != data.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match",
        )

    if data.role not in {"customer", "owner"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid account type",
        )

    existing = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
        )

    user = User(
        email=email,
        password_hash=hash_password(data.password),
        role=data.role,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "access_token": make_token(user.id),
        "token_type": "bearer",
    }


@app.post(
    "/api/auth/login",
    response_model=Token,
)
def login(
    data: LoginIn,
    db: Session = Depends(get_db),
):
    email = data.email.lower().strip()

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    if not verify_password(
        data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    return {
        "access_token": make_token(user.id),
        "token_type": "bearer",
    }


@app.get(
    "/api/auth/me",
    response_model=UserOut,
)
def me(
    user=Depends(current_user),
):
    return user


# =========================================================
# PROPERTIES
# =========================================================

@app.get(
    "/api/properties",
    response_model=list[PropertyOut],
)
def properties(
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    """
    Customer -> sees every available property.

    Owner -> sees only their own properties.

    Admin -> sees every property.
    """

    if user.role == "owner":
        return (
            db.query(Property)
            .filter(
                Property.owner_id == user.id
            )
            .order_by(Property.name)
            .all()
        )

    return (
        db.query(Property)
        .order_by(Property.name)
        .all()
    )


@app.post(
    "/api/properties",
    response_model=PropertyOut,
)
def create_property(
    data: PropertyIn,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    if user.role not in {"owner", "admin"}:
        raise HTTPException(
            status_code=403,
            detail="Only owners and admins can create properties",
        )

    # Convert the Pydantic model to a dictionary.
    # This includes contact_phone.
    property_data = data.model_dump()

    # The backend determines the owner.
    # The frontend cannot choose another owner.
    property_data["owner_id"] = user.id

    property_obj = Property(
        **property_data
    )

    db.add(property_obj)
    db.commit()
    db.refresh(property_obj)

    return property_obj


@app.delete(
    "/api/properties/{property_id}"
)
def delete_property(
    property_id: int,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    property_obj = db.get(
        Property,
        property_id,
    )

    if not property_obj:
        raise HTTPException(
            status_code=404,
            detail="Property not found",
        )

    if (
        user.role != "admin"
        and property_obj.owner_id != user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only manage your own properties",
        )

    db.delete(property_obj)
    db.commit()

    return {"ok": True}


# =========================================================
# BOOKINGS
# =========================================================

@app.get(
    "/api/bookings",
    response_model=list[BookingOut],
)
def bookings(
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    """
    Customer -> only their own bookings.

    Owner -> bookings belonging to their properties.

    Admin -> all bookings.
    """

    expire_pending(db)

    if user.role == "customer":
        return (
            db.query(Booking)
            .filter(
                Booking.customer_id == user.id
            )
            .order_by(Booking.start_at)
            .all()
        )

    if user.role == "owner":
        return (
            db.query(Booking)
            .join(Property)
            .filter(
                Property.owner_id == user.id
            )
            .order_by(Booking.start_at)
            .all()
        )

    return (
        db.query(Booking)
        .order_by(Booking.start_at)
        .all()
    )


@app.post(
    "/api/bookings",
    response_model=BookingOut,
)
def create_booking(
    data: BookingIn,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    if user.role != "customer":
        raise HTTPException(
            status_code=403,
            detail="Only customers can create bookings",
        )

    expire_pending(db)

    if data.end_at <= data.start_at:
        raise HTTPException(
            status_code=400,
            detail="End time must be after start time",
        )

    if data.deposit_amount > data.total_amount:
        raise HTTPException(
            status_code=400,
            detail="Deposit cannot exceed total amount",
        )

    property_obj = db.get(
        Property,
        data.property_id,
    )

    if not property_obj:
        raise HTTPException(
            status_code=404,
            detail="Property not found",
        )

    conflict = (
        db.query(Booking)
        .filter(
            Booking.property_id == data.property_id,
            Booking.status.in_([
                "confirmed",
                "pending",
            ]),
            Booking.start_at < data.end_at,
            Booking.end_at > data.start_at,
        )
        .first()
    )

    if conflict:
        raise HTTPException(
            status_code=409,
            detail=(
                "This property is already booked "
                "for the selected time"
            ),
        )

    booking = Booking(
        property_id=data.property_id,

        # IMPORTANT:
        # The backend gets the customer ID
        # from the authenticated account.
        customer_id=user.id,

        customer_name=user.email,

        customer_phone=data.customer_phone,

        start_at=data.start_at,
        end_at=data.end_at,

        total_amount=data.total_amount,
        deposit_amount=data.deposit_amount,

        status=data.status,
        expires_at=data.expires_at,
        notes=data.notes,
    )

    db.add(booking)
    db.commit()
    db.refresh(booking)

    return booking


@app.patch(
    "/api/bookings/{booking_id}/status"
)
def update_status(
    booking_id: int,
    status: str,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    if status not in {
        "confirmed",
        "cancelled",
        "pending",
    }:
        raise HTTPException(
            status_code=400,
            detail="Invalid status",
        )

    booking = db.get(
        Booking,
        booking_id,
    )

    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found",
        )

    property_obj = db.get(
        Property,
        booking.property_id,
    )

    # Admin can manage everything.
    if user.role == "admin":
        pass

    # Owner can manage bookings for their properties.
    elif (
        user.role == "owner"
        and property_obj
        and property_obj.owner_id == user.id
    ):
        pass

    # Customer can only cancel their own booking.
    elif (
        user.role == "customer"
        and booking.customer_id == user.id
        and status == "cancelled"
    ):
        pass

    else:
        raise HTTPException(
            status_code=403,
            detail="You cannot manage this booking",
        )

    booking.status = status

    db.commit()

    return {"ok": True}


# =========================================================
# DASHBOARD
# =========================================================

@app.get("/api/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    expire_pending(db)

    if user.role == "owner":

        rows = (
            db.query(Booking)
            .join(Property)
            .filter(
                Property.owner_id == user.id,
                Booking.status.in_([
                    "confirmed",
                    "pending",
                ]),
            )
            .all()
        )

        property_count = (
            db.query(Property)
            .filter(
                Property.owner_id == user.id
            )
            .count()
        )

    elif user.role == "customer":

        rows = (
            db.query(Booking)
            .filter(
                Booking.customer_id == user.id,
                Booking.status.in_([
                    "confirmed",
                    "pending",
                ]),
            )
            .all()
        )

        property_count = (
            db.query(Property).count()
        )

    else:

        rows = (
            db.query(Booking)
            .filter(
                Booking.status.in_([
                    "confirmed",
                    "pending",
                ])
            )
            .all()
        )

        property_count = (
            db.query(Property).count()
        )

    total = Decimal("0")
    deposits = Decimal("0")

    for booking in rows:

        total += Decimal(
            str(
                booking.total_amount or 0
            )
        )

        deposits += Decimal(
            str(
                booking.deposit_amount or 0
            )
        )

    return {
        "properties": property_count,
        "active_bookings": len(rows),
        "revenue": float(total),
        "deposits": float(deposits),
        "outstanding": float(
            total - deposits
        ),
    }


# =========================================================
# FRONTEND
# =========================================================

@app.get("/")
def home():
    return FileResponse(
        FRONTEND_DIR / "index.html"
    )