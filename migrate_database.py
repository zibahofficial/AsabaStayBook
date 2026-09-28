import sqlite3

DB_FILE = "asaba_staybook.db"

connection = sqlite3.connect(DB_FILE)
cursor = connection.cursor()

print("Starting database migration...")

# ---------------------------------------------------------
# Add owner_id to properties
# ---------------------------------------------------------

property_columns = {
    row[1]
    for row in cursor.execute(
        "PRAGMA table_info(properties)"
    ).fetchall()
}

if "owner_id" not in property_columns:
    cursor.execute(
        """
        ALTER TABLE properties
        ADD COLUMN owner_id INTEGER
        """
    )
    print("Added properties.owner_id")
else:
    print("properties.owner_id already exists")


# ---------------------------------------------------------
# Add customer_id to bookings
# ---------------------------------------------------------

booking_columns = {
    row[1]
    for row in cursor.execute(
        "PRAGMA table_info(bookings)"
    ).fetchall()
}

if "customer_id" not in booking_columns:
    cursor.execute(
        """
        ALTER TABLE bookings
        ADD COLUMN customer_id INTEGER
        """
    )
    print("Added bookings.customer_id")
else:
    print("bookings.customer_id already exists")


connection.commit()


# ---------------------------------------------------------
# Show final structure
# ---------------------------------------------------------

print("\nProperties columns:")

for row in cursor.execute(
    "PRAGMA table_info(properties)"
).fetchall():
    print(row)


print("\nBookings columns:")

for row in cursor.execute(
    "PRAGMA table_info(bookings)"
).fetchall():
    print(row)


connection.close()

print("\nDatabase migration completed successfully.")