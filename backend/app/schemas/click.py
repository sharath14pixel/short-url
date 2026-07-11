import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class ClickResponse(BaseModel):
    id: uuid.UUID
    link_id: uuid.UUID
    timestamp: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    referrer: Optional[str] = None
    country: Optional[str] = None

    class Config:
        from_attributes = True

class StatItem(BaseModel):
    label: str
    count: int

class ClickStats(BaseModel):
    total_clicks: int
    clicks_by_day: List[StatItem]
    top_referrers: List[StatItem]
    top_countries: List[StatItem]
    top_devices: List[StatItem]
    top_browsers: List[StatItem]
