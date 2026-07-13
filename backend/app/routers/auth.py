import jwt
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from app.core.config import settings

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token
)
from app.db.session import get_db
from app.models.user import User
from app.models.token import UserRefreshToken
from app.schemas.user import (
    UserSignup,
    UserLogin,
    Token,
    TokenRefresh,
    TokenRefreshResponse
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

def issue_refresh_token(response: Response, db: Session, user_id: uuid.UUID) -> str:
    """Helper to generate a refresh token, store its JTI in the database, and set it in a secure HttpOnly cookie."""
    refresh_token, refresh_jti = create_refresh_token(subject=user_id)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    db_refresh_token = UserRefreshToken(
        user_id=user_id,
        jti=refresh_jti,
        expires_at=expires_at,
        is_revoked=False
    )
    db.add(db_refresh_token)
    db.commit()
    
    # Set secure HTTP-only cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=7 * 24 * 60 * 60,  # 7 days
        path="/",
    )
    return refresh_token

@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(user_in: UserSignup, response: Response, db: Session = Depends(get_db)):
    """Register a new user account, issue HttpOnly refresh token cookie, and return credentials."""
    # Check if email is already taken
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists."
        )
    
    # Hash password and save new user
    hashed_pwd = hash_password(user_in.password)
    db_user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=hashed_pwd
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Create and set access & refresh tokens
    access_token = create_access_token(subject=db_user.id)
    refresh_token = issue_refresh_token(response, db, db_user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": db_user
    }

@router.post("/login", response_model=Token)
def login(credentials: UserLogin, response: Response, db: Session = Depends(get_db)):
    """Authenticate existing user, set HttpOnly refresh token cookie, and return access token."""
    db_user = db.query(User).filter(User.email == credentials.email).first()
    if not db_user or not verify_password(credentials.password, db_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
    
    access_token = create_access_token(subject=db_user.id)
    refresh_token = issue_refresh_token(response, db, db_user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": db_user
    }

@router.post("/refresh", response_model=TokenRefreshResponse)
def refresh_token(
    request: Request,
    response: Response,
    token_in: Optional[TokenRefresh] = None,
    db: Session = Depends(get_db)
):
    """Verify refresh token from cookie or request body, verify JTI in database, and issue new tokens."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token."
    )
    
    # Try getting token from cookie first, fall back to post body
    token = request.cookies.get("refresh_token")
    if not token and token_in:
        token = token_in.refresh_token
        
    if not token:
        raise credentials_exception
        
    try:
        payload = decode_token(token)
        token_type = payload.get("type")
        if token_type != "refresh":
            raise credentials_exception
        user_id = payload.get("sub")
        jti = payload.get("jti")
        if user_id is None or jti is None:
            raise credentials_exception
        user_uuid = uuid.UUID(user_id)
    except (jwt.PyJWTError, ValueError):
        raise credentials_exception
    
    # Verify token JTI exists and is active in the database
    db_token = db.query(UserRefreshToken).filter(UserRefreshToken.jti == jti).first()
    if not db_token or db_token.is_revoked:
        raise credentials_exception
        
    # Check expiration date
    expires_at = db_token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise credentials_exception
        
    # Check if user still exists
    db_user = db.query(User).filter(User.id == user_uuid).first()
    if not db_user:
        raise credentials_exception
        
    # Revoke old token and issue a brand-new access token + refresh token (Token Rotation)
    db_token.is_revoked = True
    db.commit()
    
    new_access_token = create_access_token(subject=db_user.id)
    issue_refresh_token(response, db, db_user.id)
    
    return {
        "access_token": new_access_token,
        "token_type": "bearer"
    }

@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Logout current user by revoking their refresh token JTI in DB and clearing cookie."""
    token = request.cookies.get("refresh_token")
    if token:
        try:
            payload = decode_token(token)
            jti = payload.get("jti")
            if jti:
                db_token = db.query(UserRefreshToken).filter(UserRefreshToken.jti == jti).first()
                if db_token:
                    db_token.is_revoked = True
                    db.commit()
        except Exception:
            pass
            
    # Always delete cookie on logout
    response.delete_cookie(
        key="refresh_token",
        path="/",
        httponly=True,
        secure=True,
        samesite="strict"
    )
    return {"detail": "Successfully logged out."}
