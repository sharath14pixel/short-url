import time
from typing import Optional
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_token
from app.db.session import get_db
from app.db.redis_client import redis_client
from app.models.user import User

# OAuth2PasswordBearer parses Authorization header for Bearer token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)

# In-memory fallback dictionary for rate limiting (key -> list of float timestamps)
IN_MEMORY_RATE_LIMITS = {}

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """Dependency that returns the logged-in user or raises 401 Unauthorized."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = decode_token(token)
        token_type = payload.get("type")
        if token_type != "access":
            raise credentials_exception
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        import uuid
        user_uuid = uuid.UUID(user_id)
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_uuid).first()
    if user is None:
        raise credentials_exception
    return user

def get_optional_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Optional[User]:
    """Dependency that returns the logged-in user if token is valid, otherwise returns None."""
    if not token:
        return None
    try:
        payload = decode_token(token)
        token_type = payload.get("type")
        if token_type != "access":
            return None
        user_id = payload.get("sub")
        if user_id is None:
            return None
        import uuid
        user_uuid = uuid.UUID(user_id)
        return db.query(User).filter(User.id == user_uuid).first()
    except jwt.PyJWTError:
        return None

def check_rate_limit(request: Request, user: Optional[User] = Depends(get_optional_user)):
    """
    Dependency that rate limits requests per IP (anonymous) or per user.
    Attempts to use Redis cache, falling back to a local in-memory store.
    """
    limit = settings.RATE_LIMIT_USER_HOUR if user else settings.RATE_LIMIT_ANONYMOUS_HOUR
    identifier = f"rate_limit:{user.id}" if user else f"rate_limit:{request.client.host if request.client else 'unknown_ip'}"
    
    # 1. Try Redis rate limiting
    if redis_client:
        try:
            pipe = redis_client.pipeline()
            pipe.incr(identifier)
            pipe.ttl(identifier)
            current_count, ttl = pipe.execute()
            
            if current_count == 1:
                # First request, set expiry to 1 hour (3600 seconds)
                redis_client.expire(identifier, 3600)
            elif current_count > limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded. Please try again later."
                )
            return
        except HTTPException:
            raise
        except Exception:
            # If Redis has connection errors or issues, fall back to in-memory
            pass
            
    # 2. Fallback in-memory rate limiting
    now = time.time()
    one_hour_ago = now - 3600
    
    if identifier not in IN_MEMORY_RATE_LIMITS:
        IN_MEMORY_RATE_LIMITS[identifier] = []
        
    # Clean up timestamps older than 1 hour
    IN_MEMORY_RATE_LIMITS[identifier] = [t for t in IN_MEMORY_RATE_LIMITS[identifier] if t > one_hour_ago]
    
    if len(IN_MEMORY_RATE_LIMITS[identifier]) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please try again later."
        )
        
    IN_MEMORY_RATE_LIMITS[identifier].append(now)
