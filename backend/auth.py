import os
import base64
import hashlib
import hmac
import json

from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .database import get_db
from .models import User


# Load environment variables before creating the secret.
load_dotenv()


try:
    import bcrypt
except ImportError:
    bcrypt = None


SECRET_VALUE = os.getenv(
    "JWT_SECRET",
    os.getenv(
        "SECRET_KEY",
        "dev-secret-change-me"
    )
)

SECRET = SECRET_VALUE.encode()

bearer = HTTPBearer(auto_error=False)


def hash_password(value: str) -> str:

    if bcrypt:
        hashed = bcrypt.hashpw(
            value.encode(),
            bcrypt.gensalt()
        )

        return "bcrypt$" + hashed.decode()

    salt = os.urandom(16)

    digest = hashlib.pbkdf2_hmac(
        "sha256",
        value.encode(),
        salt,
        210000
    )

    return (
        "pbkdf2$"
        + base64.urlsafe_b64encode(salt).decode()
        + "$"
        + base64.urlsafe_b64encode(digest).decode()
    )


def verify_password(
    value: str,
    stored: str
) -> bool:

    try:

        if stored.startswith("bcrypt$") and bcrypt:

            return bcrypt.checkpw(
                value.encode(),
                stored[7:].encode()
            )

        _, salt_value, digest_value = stored.split("$")

        salt = base64.urlsafe_b64decode(
            salt_value
        )

        expected = base64.urlsafe_b64decode(
            digest_value
        )

        actual = hashlib.pbkdf2_hmac(
            "sha256",
            value.encode(),
            salt,
            210000
        )

        return hmac.compare_digest(
            actual,
            expected
        )

    except Exception:
        return False


def _b64(value: bytes) -> str:

    return base64.urlsafe_b64encode(
        value
    ).rstrip(b"=").decode()


def make_token(user_id: int):

    header = _b64(
        b'{"alg":"HS256","typ":"JWT"}'
    )

    payload = _b64(
        json.dumps(
            {
                "sub": str(user_id),
                "exp": int(
                    (
                        datetime.now(timezone.utc)
                        + timedelta(hours=12)
                    ).timestamp()
                )
            }
        ).encode()
    )

    signature = _b64(
        hmac.new(
            SECRET,
            f"{header}.{payload}".encode(),
            hashlib.sha256
        ).digest()
    )

    return (
        f"{header}.{payload}.{signature}"
    )


def current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db)
):

    if not creds:
        raise HTTPException(
            status_code=401,
            detail="Login required"
        )

    try:

        header, payload, signature = (
            creds.credentials.split(".")
        )

        expected_signature = _b64(
            hmac.new(
                SECRET,
                f"{header}.{payload}".encode(),
                hashlib.sha256
            ).digest()
        )

        if not hmac.compare_digest(
            signature,
            expected_signature
        ):
            raise ValueError()

        data = json.loads(
            base64.urlsafe_b64decode(
                payload + "==="
            )
        )

        if int(data["exp"]) < int(
            datetime.now(
                timezone.utc
            ).timestamp()
        ):
            raise ValueError()

        user_id = int(data["sub"])

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    user = db.get(
        User,
        user_id
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return user
