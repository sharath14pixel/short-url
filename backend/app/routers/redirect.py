import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import httpx
from user_agents import parse

from app.db.session import get_db, SessionLocal
from app.db.redis_client import redis_client
from app.models.link import Link
from app.models.click import Click

router = APIRouter(tags=["Redirect"])

def get_country_from_ip(ip: str) -> str:
    """Helper to perform GeoIP lookup using a public free API with small timeout."""
    if not ip or ip in ("127.0.0.1", "::1", "localhost", "172.17.0.1"):
        return "Localhost"
    try:
        # Query free ip-api with a short timeout to prevent blocking background tasks
        response = httpx.get(f"http://ip-api.com/json/{ip}", timeout=1.0)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "success":
                return data.get("country", "Unknown")
    except Exception:
        pass
    return "Unknown"

def async_log_click(
    link_id: uuid.UUID,
    ip_address: Optional[str],
    user_agent: Optional[str],
    referrer: Optional[str]
):
    """Background task to resolve geo-location, parse device/browser, and save Click record."""
    country = get_country_from_ip(ip_address)
    
    # Open a new database session because the request session might already be closed
    db: Session = SessionLocal()
    try:
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
    """
    original_url = None
    
    # 1. Try checking Redis Cache first
    if redis_client:
        try:
            original_url = redis_client.get(short_code)
        except Exception:
            pass
            
    link_id = None
    
    # 2. Cache Miss: Query Database
    if not original_url:
        # Find link by short_code OR custom_alias
        link = db.query(Link).filter(
            (Link.short_code == short_code) | (Link.custom_alias == short_code)
        ).first()
        
        if not link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Short link not found."
            )
            
        # Check active status
        if not link.is_active:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This link has been deactivated."
            )
            
        # Check expiration date
        if link.expires_at and link.expires_at < datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This link has expired."
            )
            
        original_url = link.original_url
        link_id = link.id
        
        # Populate Redis Cache with expiration aware TTL
        if redis_client:
            try:
                if link.expires_at:
                    ttl = int((link.expires_at - datetime.utcnow()).total_seconds())
                    if ttl > 0:
                        redis_client.setex(short_code, ttl, original_url)
                else:
                    redis_client.setex(short_code, 86400, original_url) # Cache for 24 hours
            except Exception:
                pass
    else:
        # Cache hit: we still need the link_id to log the click, let's query it quickly.
        # This keeps the DB load low (only fetching the ID).
        link_data = db.query(Link.id, Link.is_active, Link.expires_at).filter(
            (Link.short_code == short_code) | (Link.custom_alias == short_code)
        ).first()
        
        if not link_data:
            # If cache is out of sync with DB (e.g. deleted link), clean cache
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
            
        if link_data.expires_at and link_data.expires_at < datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This link has expired."
            )
            
        link_id = link_data.id

    # 3. Log click event asynchronously using BackgroundTasks
    ip_address = request.client.host if request.client else None
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
