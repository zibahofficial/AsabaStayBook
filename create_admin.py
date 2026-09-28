import sqlite3
from backend.auth import hash_password

DB_FILE = "asaba_staybook.db"

email = "admin@asaba.local"
password = "ChangeMe123!"

connection = sqlite3.connect(DB_FILE)
cursor = connection.cursor()

existing = cursor.execute(
    "SELECT id FROM users WHERE email = ?",
    (email,),
).fetchone()

if existing:
    cursor.execute(
        """
        UPDATE users
        SET role = ?, password_hash = ?
        WHERE email = ?
        """,
        (
            "admin",
            hash_password(password),
            email,
        ),
    )

    print("Existing admin account updated.")

else:
    cursor.execute(
        """
        INSERT INTO users
        (email, password_hash, role)
        VALUES (?, ?, ?)
        """,
        (
            email,
            hash_password(password),
            "admin",
        ),
    )

    print("Admin account created.")

connection.commit()
connection.close()

print()
print("Admin email:", email)
print("Admin password:", password)