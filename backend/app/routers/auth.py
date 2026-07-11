import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import (
    UserSignup,
    UserLogin,
    UserResponse,
    Token,
    TokenRefresh,
    TokenRefreshResponse
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(user_in: UserSignup, db: Session = Depends(get_db)):
    """Register a new user account and return credentials."""
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
    
    # Create tokens
    access_token = create_access_token(subject=db_user.id)
    refresh_token = create_refresh_token(subject=db_user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": db_user
    }

@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Authenticate existing user and return access & refresh tokens."""
    db_user = db.query(User).filter(User.email == credentials.email).first()
    if not db_user or not verify_password(credentials.password, db_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
    
    access_token = create_access_token(subject=db_user.id)
    refresh_token = create_refresh_token(subject=db_user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": db_user
    }

@router.post("/refresh", response_model=TokenRefreshResponse)
def refresh_token(token_in: TokenRefresh, db: Session = Depends(get_db)):
    """Verify refresh token and issue a new access token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token."
    )
    try:
        payload = decode_token(token_in.refresh_token)
        token_type = payload.get("type")
        if token_type != "refresh":
            raise credentials_exception
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        import uuid
        user_uuid = uuid.UUID(user_id)
    except jwt.PyJWTError:
        raise credentials_exception
    
    # Check if user still exists
    db_user = db.query(User).filter(User.id == user_uuid).first()
    if not db_user:
        raise credentials_exception
        
    new_access_token = create_access_token(subject=db_user.id)
    return {
        "access_token": new_access_token,
        "token_type": "bearer"
    }
