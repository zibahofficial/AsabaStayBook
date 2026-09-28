# Deployment: Vercel + Neon PostgreSQL

1. Create a Neon PostgreSQL database.
2. Copy its PostgreSQL connection string.
3. In Vercel, import this project from GitHub (after local testing).
4. Add environment variables:
   - DATABASE_URL = your Neon PostgreSQL URL
   - JWT_SECRET = a long random secret
   - ADMIN_EMAIL = your admin email
   - ADMIN_PASSWORD = a strong admin password
   - CORS_ORIGINS = your Vercel app URL
5. Deploy.
6. Open `https://YOUR-APP.vercel.app/api/health`. It should return `{"status":"ok"}`.
7. Open the main URL and sign in.

Important: Neon is the PostgreSQL provider; Vercel is the hosting/deployment platform. Do not put database credentials in the repository.
