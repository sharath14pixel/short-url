import uuid
from collections import Counter
from typing import List
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
# pyrefly: ignore [missing-import]
from user_agents import parse

from app.db.session import get_db
from app.models.link import Link
from app.models.click import Click
from app.models.user import User
from app.schemas.click import ClickResponse, ClickStats, StatItem
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/links", tags=["Analytics"])

@router.get("/{id}/clicks", response_model=List[ClickResponse])
def get_link_clicks(
    id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Retrieve detailed click log for a specific link. Requires authentication."""
    # Check that link exists and belongs to current user
    link = db.query(Link).filter(Link.id == id, Link.user_id == user.id).first()
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Link not found or access denied."
        )
        
    clicks = db.query(Click).filter(Click.link_id == id)\
        .order_by(Click.timestamp.desc())\
        .offset(skip).limit(limit).all()
        
    return clicks

@router.get("/{id}/stats", response_model=ClickStats)
def get_link_stats(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get aggregated click analytics (referrers, locations, devices, browsers). Requires authentication."""
    link = db.query(Link).filter(Link.id == id, Link.user_id == user.id).first()
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Link not found or access denied."
        )
        
    # Fetch all clicks for this link
    clicks = db.query(Click).filter(Click.link_id == id).all()
    total_clicks = len(clicks)
    
    # 1. Group Clicks by Day (YYYY-MM-DD)
    day_counter = Counter()
    for click in clicks:
        day_str = click.timestamp.strftime("%Y-%m-%d")
        day_counter[day_str] += 1
    # Sort chronologically by date
    clicks_by_day = [
        StatItem(label=day, count=count) 
        for day, count in sorted(day_counter.items())
    ]
    
    # 2. Top Referrers (parse hostname for cleaner logs)
    ref_counter = Counter()
    for click in clicks:
        ref = click.referrer
        if not ref:
            ref_label = "Direct / Email"
        else:
            try:
                parsed_ref = urlparse(ref)
                ref_label = parsed_ref.netloc or ref
                if not ref_label:
                    ref_label = ref
            except Exception:
                ref_label = ref
        ref_counter[ref_label] += 1
    top_referrers = [
        StatItem(label=ref, count=count) 
        for ref, count in ref_counter.most_common(10)
    ]
    
    # 3. Top Countries
    country_counter = Counter()
    for click in clicks:
        country_counter[click.country or "Unknown"] += 1
    top_countries = [
        StatItem(label=country, count=count) 
        for country, count in country_counter.most_common(10)
    ]
    
    # 4. Devices and Browsers parsing via user-agents
    device_counter = Counter()
    browser_counter = Counter()
    
    for click in clicks:
        ua_str = click.user_agent
        if not ua_str:
            device_counter["Unknown"] += 1
            browser_counter["Unknown"] += 1
            continue
            
        try:
            ua = parse(ua_str)
            
            # Browser Name (e.g., Chrome, Safari, Mobile Safari, Firefox)
            browser_label = ua.browser.family
            browser_counter[browser_label] += 1
            
            # Device Category
            if ua.is_pc:
                device_label = "Desktop"
            elif ua.is_mobile:
                device_label = "Mobile"
            elif ua.is_tablet:
                device_label = "Tablet"
            elif ua.is_bot:
                device_label = "Search Bot"
            else:
                device_label = "Other / Unknown"
            device_counter[device_label] += 1
        except Exception:
            device_counter["Unknown"] += 1
            browser_counter["Unknown"] += 1
            
    top_devices = [
        StatItem(label=dev, count=count) 
        for dev, count in device_counter.most_common(5)
    ]
    top_browsers = [
        StatItem(label=browser, count=count) 
        for browser, count in browser_counter.most_common(5)
    ]
    
    return ClickStats(
        total_clicks=total_clicks,
        clicks_by_day=clicks_by_day,
        top_referrers=top_referrers,
        top_countries=top_countries,
        top_devices=top_devices,
        top_browsers=top_browsers
    )
