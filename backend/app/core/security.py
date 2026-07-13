from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union
import uuid
import jwt
import bcrypt
from app.core.config import settings

def hash_password(password: str) -> str:
    """Hash a plain text password using bcrypt directly."""
    # Convert password to bytes
    password_bytes = password.encode("utf-8")
    # Generate salt and hash
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against the stored bcrypt hash."""
    try:
        plain_bytes = plain_password.encode("utf-8")
        hashed_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(plain_bytes, hashed_bytes)
    except Exception:
        return False

def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a short-lived access JWT token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire, "sub": str(subject), "type": "access"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None, jti: Optional[str] = None) -> tuple[str, str]:
    """Create a longer-lived refresh JWT token. Returns a tuple (encoded_jwt, jti)."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    token_jti = jti or str(uuid.uuid4())
    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh", "jti": token_jti}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt, token_jti

def decode_token(token: str) -> Dict[str, Any]:
    """Decode a JWT and return the payload. Raises jwt.PyJWTError if invalid."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
