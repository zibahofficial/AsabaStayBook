import os

from datetime import datetime, timezone
from decimal import Decimal

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

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
    BookingOut
)
from .auth import (
    verify_password,
    hash_password,
    make_token,
    current_user
)


Base.metadata.create_all(engine)


app = FastAPI(
    title="AsabaStayBook API",
    version="1.0.0"
)


origins = [
    x.strip()
    for x in os.getenv(
        "CORS_ORIGINS",
        "http://127.0.0.1:5500,http://localhost:5500"
    ).split(",")
    if x.strip()
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


app.mount(
    "/assets",
    StaticFiles(
        directory="frontend/assets"
    ),
    name="assets"
)


def expire_pending(db):

    now = (
        datetime.now(timezone.utc)
        .replace(tzinfo=None)
    )

    rows = (
        db.query(Booking)
        .filter(
            Booking.status == "pending",
            Booking.expires_at.isnot(None),
            Booking.expires_at < now
        )
        .all()
    )

    for booking in rows:
        booking.status = "expired"

    if rows:
        db.commit()


@app.get("/api/health")
def health():

    return {
        "status": "ok"
    }


@app.post(
    "/api/auth/register",
    response_model=Token
)
def register(
    data: RegisterIn,
    db: Session = Depends(get_db)
):

    email = data.email.lower().strip()

    if data.password != data.confirm_password:

        raise HTTPException(
            status_code=400,
            detail="Passwords do not match"
        )

    if data.role not in {
        "customer",
        "owner"
    }:

        raise HTTPException(
            status_code=400,
            detail="Invalid account type"
        )

    existing = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing:

        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists"
        )

    user = User(
        email=email,
        password_hash=hash_password(
            data.password
        ),
        role=data.role
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "access_token": make_token(user.id),
        "token_type": "bearer"
    }


@app.post(
    "/api/auth/login",
    response_model=Token
)
def login(
    data: LoginIn,
    db: Session = Depends(get_db)
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
            detail="Invalid email or password"
        )

    if not verify_password(
        data.password,
        user.password_hash
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    return {
        "access_token": make_token(user.id),
        "token_type": "bearer"
    }


@app.get(
    "/api/auth/me",
    response_model=UserOut
)
def me(
    user=Depends(current_user)
):

    return user


@app.get(
    "/api/properties",
    response_model=list[PropertyOut]
)
def properties(
    db: Session = Depends(get_db),
    user=Depends(current_user)
):

    return (
        db.query(Property)
        .order_by(Property.name)
        .all()
    )


@app.post(
    "/api/properties",
    response_model=PropertyOut
)
def create_property(
    data: PropertyIn,
    db: Session = Depends(get_db),
    user=Depends(current_user)
):

    if user.role not in {
        "admin",
        "owner"
    }:

        raise HTTPException(
            status_code=403,
            detail="Only property owners and admins can create properties"
        )

    p = Property(
        **data.model_dump()
    )

    db.add(p)
    db.commit()
    db.refresh(p)

    return p


@app.get(
    "/api/bookings",
    response_model=list[BookingOut]
)
def bookings(
    db: Session = Depends(get_db),
    user=Depends(current_user)
):

    expire_pending(db)

    return (
        db.query(Booking)
        .order_by(Booking.start_at)
        .all()
    )


@app.post(
    "/api/bookings",
    response_model=BookingOut
)
def create_booking(
    data: BookingIn,
    db: Session = Depends(get_db),
    user=Depends(current_user)
):

    expire_pending(db)

    if data.end_at <= data.start_at:

        raise HTTPException(
            status_code=400,
            detail="End time must be after start time"
        )

    if data.deposit_amount > data.total_amount:

        raise HTTPException(
            status_code=400,
            detail="Deposit cannot exceed total amount"
        )

    if not db.get(
        Property,
        data.property_id
    ):

        raise HTTPException(
            status_code=404,
            detail="Property not found"
        )

    conflict = (
        db.query(Booking)
        .filter(
            Booking.property_id
            == data.property_id,

            Booking.status.in_(
                [
                    "confirmed",
                    "pending"
                ]
            ),

            Booking.start_at
            < data.end_at,

            Booking.end_at
            > data.start_at
        )
        .first()
    )

    if conflict:

        raise HTTPException(
            status_code=409,
            detail="This property is already booked for the selected time"
        )

    booking = Booking(
        **data.model_dump()
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
    user=Depends(current_user)
):

    if status not in {
        "confirmed",
        "cancelled",
        "pending"
    }:

        raise HTTPException(
            status_code=400,
            detail="Invalid status"
        )

    booking = db.get(
        Booking,
        booking_id
    )

    if not booking:

        raise HTTPException(
            status_code=404,
            detail="Booking not found"
        )

    booking.status = status

    db.commit()

    return {
        "ok": True
    }


@app.get("/api/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    user=Depends(current_user)
):

    expire_pending(db)

    rows = (
        db.query(Booking)
        .filter(
            Booking.status.in_(
                [
                    "confirmed",
                    "pending"
                ]
            )
        )
        .all()
    )

    total = Decimal("0")
    deposits = Decimal("0")

    for booking in rows:

        total += Decimal(
            str(
                booking.total_amount
                or 0
            )
        )

        deposits += Decimal(
            str(
                booking.deposit_amount
                or 0
            )
        )

    return {
        "properties":
            db.query(Property).count(),

        "active_bookings":
            len(rows),

        "revenue":
            float(total),

        "deposits":
            float(deposits),

        "outstanding":
            float(total - deposits)
    }


@app.get("/")
def home():

    return FileResponse(
        "frontend/index.html"
    )