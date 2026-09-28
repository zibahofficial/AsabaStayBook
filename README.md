# AsabaStayBook

A small full-stack booking and deposit tracker for hotels, shortlets and event centres in Asaba, Delta State, Nigeria.

## Stack
- Frontend: HTML5, CSS3, Vanilla JavaScript
- Backend: Python 3.12 + FastAPI + SQLAlchemy + Pydantic + JWT
- Database: PostgreSQL (local development; Neon PostgreSQL for Vercel deployment)
- Deployment: Vercel

## Core features
- Dashboard for properties, bookings and deposits
- Calendar view
- Booking creation with overlap/double-booking prevention
- Deposit tracking and outstanding balance
- Automatic expiry of pending bookings after `expires_at`
- Property management
- Simple admin authentication
- Responsive professional UI with local real-photo assets

## Local setup
1. Create a PostgreSQL database, e.g. `asaba_staybook`.
2. Copy `.env.example` to `.env` and set your local PostgreSQL values.
3. Create a Python 3.12 virtual environment.
4. `pip install -r requirements.txt`
5. `python backend/seed.py`
6. `uvicorn backend.main:app --reload`
7. Open http://127.0.0.1:8000

Default development admin from `.env.example`: `admin@asaba.local` / `ChangeMe123!`
Change it before any real deployment.

## API health
`GET /api/health` returns `{"status":"ok"}`.

## Vercel + Neon
Set `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in Vercel project environment variables. Neon provides the PostgreSQL connection string. Do not commit `.env`.
