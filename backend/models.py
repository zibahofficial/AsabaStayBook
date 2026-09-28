from datetime import datetime

from sqlalchemy import (
    String,
    Integer,
    Numeric,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
    )

    role: Mapped[str] = mapped_column(
        String(30),
        default="customer",
    )

    properties: Mapped[list["Property"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
    )

    bookings: Mapped[list["Booking"]] = relationship(
        back_populates="customer",
        foreign_keys="Booking.customer_id",
    )


class Property(Base):
    __tablename__ = "properties"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        index=True,
        nullable=True,
    )

    name: Mapped[str] = mapped_column(
        String(160),
    )

    kind: Mapped[str] = mapped_column(
        String(30),
    )

    location: Mapped[str] = mapped_column(
        String(180),
    )

    capacity: Mapped[int] = mapped_column(
        Integer,
        default=1,
    )

    price_per_day: Mapped[float] = mapped_column(
        Numeric(12, 2),
        default=0,
    )

    image: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Phone number customers should contact for
    # payment instructions or more information.
    contact_phone: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    owner: Mapped[User | None] = relationship(
        back_populates="properties",
        foreign_keys=[owner_id],
    )

    bookings: Mapped[list["Booking"]] = relationship(
        back_populates="property",
        cascade="all, delete-orphan",
    )


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    property_id: Mapped[int] = mapped_column(
        ForeignKey("properties.id"),
        index=True,
    )

    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        index=True,
        nullable=True,
    )

    customer_name: Mapped[str] = mapped_column(
        String(160),
    )

    customer_phone: Mapped[str] = mapped_column(
        String(50),
    )

    start_at: Mapped[datetime] = mapped_column(
        DateTime,
        index=True,
    )

    end_at: Mapped[datetime] = mapped_column(
        DateTime,
        index=True,
    )

    total_amount: Mapped[float] = mapped_column(
        Numeric(12, 2),
        default=0,
    )

    deposit_amount: Mapped[float] = mapped_column(
        Numeric(12, 2),
        default=0,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="confirmed",
    )

    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    property: Mapped[Property] = relationship(
        back_populates="bookings",
    )

    customer: Mapped[User | None] = relationship(
        back_populates="bookings",
        foreign_keys=[customer_id],
    )