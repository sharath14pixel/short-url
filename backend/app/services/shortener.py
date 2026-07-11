import string
import random
import urllib.parse
import socket
import ipaddress
from typing import Optional
from sqlalchemy.orm import Session
from app.models.link import Link
from app.core.config import settings

BASE62_CHARACTERS = string.ascii_letters + string.digits

def generate_base62_code(length: int = 6) -> str:
    """Generate a random Base62 string of specific length."""
    return "".join(random.choices(BASE62_CHARACTERS, k=length))

def is_code_available(db: Session, code: str) -> bool:
    """Check if the given short code or alias is available (not restricted and not in use)."""
    if code.lower() in settings.RESTRICTED_WORDS:
        return False
    
    # Check database for existing short_code or custom_alias
    exists = db.query(Link).filter(
        (Link.short_code == code) | (Link.custom_alias == code)
    ).first()
    return exists is None

def generate_unique_short_code(db: Session) -> str:
    """Generate a unique 6 to 7 character Base62 short code."""
    for _ in range(10):
        length = random.randint(6, 7)
        code = generate_base62_code(length)
        if is_code_available(db, code):
            return code
    raise ValueError("System was unable to generate a unique short code. Please try again.")

def is_ssrf_safe(url: str) -> bool:
    """
    Validate that the URL's target host resolves to a public, non-local IP address
    to protect against SSRF (Server-Side Request Forgery).
    """
    try:
        parsed_url = urllib.parse.urlparse(url)
        hostname = parsed_url.hostname
        if not hostname:
            return False
        
        # Resolve hostname to IP address
        ip_addr_str = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(ip_addr_str)
        
        # Block private, loopback, multicast, link-local, and reserved ranges
        if (ip.is_private or 
            ip.is_loopback or 
            ip.is_link_local or 
            ip.is_reserved or 
            ip.is_multicast or 
            ip_addr_str == "0.0.0.0"):
            return False
        return True
    except Exception:
        # If hostname cannot be resolved, we block it for safety
        return False
