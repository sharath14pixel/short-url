import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from user_agents import parse
from pydantic import BaseModel

from app.db.session import get_db, SessionLocal
from app.db.redis_client import redis_client
from app.models.link import Link
from app.models.click import Click
from app.services.geoip import get_country

router = APIRouter(tags=["Redirect"])

class LinkVerify(BaseModel):
    password: str

def async_log_click(
    link_id: uuid.UUID,
    ip_address: Optional[str],
    user_agent: Optional[str],
    referrer: Optional[str]
):
    """Background task to save Click record. Performs local/offline Geo-IP lookup."""
    db: Session = SessionLocal()
    try:
        # Perform offline local Geo-IP lookup
        country = get_country(ip_address) if ip_address else None
        
        db_click = Click(
            link_id=link_id,
            ip_address=ip_address,
            user_agent=user_agent,
            referrer=referrer,
            country=country
        )
        db.add(db_click)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()

@router.get("/{short_code}", response_class=RedirectResponse)
def redirect_to_original(
    short_code: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Look up short_code or custom_alias, log click event asynchronously,
    and return a 302 RedirectResponse to the original URL.
    Enforces expiry (410) and password-protection (401) checks.
    """
    original_url = None
    link_id = None
    
    # 1. Try checking Redis Cache first (only if link is not password protected)
    if redis_client:
        try:
            original_url = redis_client.get(short_code)
        except Exception:
            pass
            
    # 2. Check if cached link is valid and not password protected
    if original_url:
        # Fetch status, expiry, and password_hash from DB to verify before redirect
        link_data = db.query(Link.id, Link.is_active, Link.expires_at, Link.password_hash).filter(
            (Link.short_code == short_code) | (Link.custom_alias == short_code)
        ).first()
        
        if not link_data:
            # If cache is out of sync with DB, clean cache
            if redis_client:
                try:
                    redis_client.delete(short_code)
                except Exception:
                    pass
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Short link not found."
            )
            
        if not link_data.is_active:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This link has been deactivated."
            )
            
        now_time = datetime.now(timezone.utc)
        link_expires_at = link_data.expires_at
        if link_expires_at and link_expires_at.tzinfo is None:
            link_expires_at = link_expires_at.replace(tzinfo=timezone.utc)

        if link_expires_at and link_expires_at < now_time:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This link has expired."
            )
            
        # If the link requires password verification, block immediate redirect and raise 401
        if link_data.password_hash:
            # Remove from cache to avoid future bypasses
            if redis_client:
                try:
                    redis_client.delete(short_code)
                except Exception:
                    pass
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="password_required"
            )
            
        link_id = link_data.id
    else:
        # DB Query (Cache Miss)
        link = db.query(Link).filter(
            (Link.short_code == short_code) | (Link.custom_alias == short_code)
        ).first()
        
        if not link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Short link not found."
            )
            
        if not link.is_active:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This link has been deactivated."
            )
            
        now_time = datetime.now(timezone.utc)
        link_expires_at = link.expires_at
        if link_expires_at and link_expires_at.tzinfo is None:
            link_expires_at = link_expires_at.replace(tzinfo=timezone.utc)

        if link_expires_at and link_expires_at < now_time:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This link has expired."
            )
            
        # If the link requires password verification, block immediate redirect and raise 401
        if link.password_hash:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="password_required"
            )
            
        original_url = link.original_url
        link_id = link.id
        
        # Populate Redis Cache with expiration aware TTL (only if NOT password protected)
        if redis_client:
            try:
                if link.expires_at:
                    link_expires_at = link.expires_at
                    if link_expires_at.tzinfo is None:
                        link_expires_at = link_expires_at.replace(tzinfo=timezone.utc)
                    ttl = int((link_expires_at - now_time).total_seconds())
                    if ttl > 0:
                        redis_client.setex(short_code, ttl, original_url)
                else:
                    redis_client.setex(short_code, 86400, original_url)
            except Exception:
                pass

    # 3. Log click event asynchronously using BackgroundTasks
    x_forwarded_for = request.headers.get("x-forwarded-for")
    ip_address = x_forwarded_for.split(",")[0].strip() if x_forwarded_for else (request.client.host if request.client else None)
    user_agent = request.headers.get("user-agent")
    referrer = request.headers.get("referer")
    
    background_tasks.add_task(
        async_log_click,
        link_id=link_id,
        ip_address=ip_address,
        user_agent=user_agent,
        referrer=referrer
    )
    
    # 4. Perform 302 Redirect
    return RedirectResponse(url=original_url, status_code=status.HTTP_302_FOUND)

@router.post("/{short_code}/verify")
def verify_password_protected_link(
    short_code: str,
    verify_in: LinkVerify,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Verify password for a protected link and return the destination URL."""
    link = db.query(Link).filter(
        (Link.short_code == short_code) | (Link.custom_alias == short_code)
    ).first()
    
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Short link not found."
        )
        
    if not link.is_active:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This link has been deactivated."
        )
        
    # Check expiry
    now_time = datetime.now(timezone.utc)
    link_expires_at = link.expires_at
    if link_expires_at and link_expires_at.tzinfo is None:
        link_expires_at = link_expires_at.replace(tzinfo=timezone.utc)
    if link_expires_at and link_expires_at < now_time:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This link has expired."
        )
        
    if not link.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This link is not password protected."
        )
        
    from app.core.security import verify_password
    if not verify_password(verify_in.password, link.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password."
        )
        
    # Log click event asynchronously using BackgroundTasks
    x_forwarded_for = request.headers.get("x-forwarded-for")
    ip_address = x_forwarded_for.split(",")[0].strip() if x_forwarded_for else (request.client.host if request.client else None)
    user_agent = request.headers.get("user-agent")
    referrer = request.headers.get("referer")
    
    background_tasks.add_task(
        async_log_click,
        link_id=link.id,
        ip_address=ip_address,
        user_agent=user_agent,
        referrer=referrer
    )
    
    return {"destination_url": link.original_url}
