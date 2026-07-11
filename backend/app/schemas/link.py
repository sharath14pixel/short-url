import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator
import re

class LinkBase(BaseModel):
    original_url: str = Field(..., description="The original URL to shorten")
    custom_alias: Optional[str] = Field(None, min_length=3, max_length=50, description="Optional custom short code alias")
    expires_at: Optional[datetime] = Field(None, description="Optional expiration date/time")

    @field_validator("original_url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        # Check basic URL structure (http/https scheme)
        if not re.match(r"^https?://[^\s/$.?#].[^\s]*$", v, re.IGNORECASE):
            raise ValueError("URL must be a valid HTTP or HTTPS address")
        return v

    @field_validator("custom_alias")
    @classmethod
    def validate_custom_alias(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        # Ensure only alphanumeric and hyphen
        if not re.match(r"^[a-zA-Z0-9\-]+$", v):
            raise ValueError("Custom alias must only contain alphanumeric characters and hyphens")
        return v

class LinkCreate(LinkBase):
    pass

class LinkUpdate(BaseModel):
    custom_alias: Optional[str] = Field(None, min_length=3, max_length=50)
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None

    @field_validator("custom_alias")
    @classmethod
    def validate_custom_alias(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not re.match(r"^[a-zA-Z0-9\-]+$", v):
            raise ValueError("Custom alias must only contain alphanumeric characters and hyphens")
        return v

class LinkResponse(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID]
    original_url: str
    short_code: str
    custom_alias: Optional[str]
    short_url: str
    is_active: bool
    expires_at: Optional[datetime]
    created_at: datetime
    qr_code_base64: Optional[str] = None
    click_count: int = 0

    class Config:
        from_attributes = True
