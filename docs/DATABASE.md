# Database

Tables:
- users: admin login credentials and role.
- properties: hotel, shortlet or event centre details.
- bookings: customer reservation, date/time range, total, deposit, status and expiry.

Business rule: an active confirmed/pending booking overlaps another booking when `existing.start_at < new.end_at` AND `existing.end_at > new.start_at` for the same property. Such a booking is rejected with HTTP 409.
