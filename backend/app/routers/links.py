import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.redis_client import redis_client
from app.models.link import Link
from app.models.user import User
from app.schemas.link import LinkCreate, LinkUpdate, LinkResponse
from app.services.shortener import (
    generate_unique_short_code,
    is_code_available,
    is_ssrf_safe
)
from app.services.qrcode import generate_qr_code_base64
from app.utils.dependencies import get_optional_user, get_current_user, check_rate_limit

router = APIRouter(prefix="/api/links", tags=["Links"])

def make_link_response(link: Link, request: Request, db: Session, include_qr: bool = True) -> LinkResponse:
    """Helper to convert database Link object to LinkResponse including QR code and stats."""
    code_or_alias = link.custom_alias or link.short_code
    # Build short URL
    base_url = str(request.base_url)
    short_url = f"{base_url}{code_or_alias}"
    
    # Generate QR Code
    qr_code = generate_qr_code_base64(short_url) if include_qr else None
    
    # Count clicks
    from app.models.click import Click
    click_count = db.query(Click).filter(Click.link_id == link.id).count()
    
    return LinkResponse(
        id=link.id,
        user_id=link.user_id,
        original_url=link.original_url,
        short_code=link.short_code,
        custom_alias=link.custom_alias,
        short_url=short_url,
        is_active=link.is_active,
        expires_at=link.expires_at,
        created_at=link.created_at,
        qr_code_base64=qr_code,
        click_count=click_count,
        is_password_protected=link.is_password_protected
    )

def invalidate_link_cache(short_code: str, custom_alias: Optional[str] = None):
    """Remove short code and custom alias from Redis cache."""
    if redis_client:
        try:
            redis_client.delete(short_code)
            if custom_alias:
                redis_client.delete(custom_alias)
        except Exception:
            pass

@router.post("", response_model=LinkResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(check_rate_limit)])
def create_link(
    link_in: LinkCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user)
):
    """
    Create a new short link.
    If authenticated, links to the user.
    Protects against SSRF and validates custom alias availability.
    """
    # 1. SSRF prevention
    if not is_ssrf_safe(link_in.original_url):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The provided URL is invalid or blocked for safety reasons (SSRF Protection)."
        )
    
    short_code = None
    custom_alias = None
    
    # 2. Check Custom Alias or generate Short Code
    if link_in.custom_alias:
        alias = link_in.custom_alias
        if not is_code_available(db, alias):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"The alias '{alias}' is already in use or restricted."
            )
        custom_alias = alias
        # Also need a fallback short_code even when alias is provided
        short_code = generate_unique_short_code(db)
    else:
        short_code = generate_unique_short_code(db)
        
    from app.core.security import hash_password
    password_hash = hash_password(link_in.password) if link_in.password else None

    # 3. Save to database
    db_link = Link(
        user_id=user.id if user else None,
        original_url=link_in.original_url,
        short_code=short_code,
        custom_alias=custom_alias,
        expires_at=link_in.expires_at,
        password_hash=password_hash
    )
    db.add(db_link)
    db.commit()
    db.refresh(db_link)
    
    # 4. If Redis cache is available, pre-populate cache
    if redis_client:
        try:
            # Cache the code/alias key pointing to original url
            redis_client.setex(short_code, 86400, db_link.original_url)  # 24h default TTL
            if custom_alias:
                redis_client.setex(custom_alias, 86400, db_link.original_url)
        except Exception:
            pass
            
    return make_link_response(db_link, request, db)

@router.get("", response_model=List[LinkResponse])
def list_links(
    request: Request,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """List current user's links (paginated). Requires authentication."""
    links = db.query(Link).filter(Link.user_id == user.id)\
        .order_by(Link.created_at.desc())\
        .offset(skip).limit(limit).all()
        
    return [make_link_response(link, request, db, include_qr=False) for link in links]

@router.get("/{id}", response_model=LinkResponse)
def get_link(
    id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Retrieve detailed stats and info for a specific link. Requires authentication."""
    link = db.query(Link).filter(Link.id == id, Link.user_id == user.id).first()
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Link not found or access denied."
        )
    return make_link_response(link, request, db)

@router.put("/{id}", response_model=LinkResponse)
def update_link(
    id: uuid.UUID,
    link_in: LinkUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Update custom alias, expiration date, or active status of a link."""
    link = db.query(Link).filter(Link.id == id, Link.user_id == user.id).first()
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Link not found or access denied."
        )
        
    # Invalidate cache for current code/alias before updates
    invalidate_link_cache(link.short_code, link.custom_alias)
    
    if "custom_alias" in link_in.model_fields_set:
        alias = link_in.custom_alias
        # Only validate if alias is actually changing
        if alias != link.custom_alias:
            if alias is not None and not is_code_available(db, alias):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"The alias '{alias}' is already in use or restricted."
                )
            link.custom_alias = alias
            
    if "expires_at" in link_in.model_fields_set:
        link.expires_at = link_in.expires_at
        
    if "is_active" in link_in.model_fields_set and link_in.is_active is not None:
        link.is_active = link_in.is_active

    if "password" in link_in.model_fields_set:
        from app.core.security import hash_password
        if link_in.password == "" or link_in.password is None:
            link.password_hash = None
        else:
            link.password_hash = hash_password(link_in.password)
        
    db.commit()
    db.refresh(link)
    
    # Seed cache again if active
    if link.is_active and redis_client:
        try:
            redis_client.setex(link.short_code, 86400, link.original_url)
            if link.custom_alias:
                redis_client.setex(link.custom_alias, 86400, link.original_url)
        except Exception:
            pass
            
    return make_link_response(link, request, db)

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_link(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Delete a short link. Invalidates caching and cascades delete clicks."""
    link = db.query(Link).filter(Link.id == id, Link.user_id == user.id).first()
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Link not found or access denied."
        )
        
    # Invalidate cache
    invalidate_link_cache(link.short_code, link.custom_alias)
    
    db.delete(link)
    db.commit()
    return None
