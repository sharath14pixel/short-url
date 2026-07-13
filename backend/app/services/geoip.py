import os
import geoip2.database
from typing import Optional

# Path to the GeoLite2-Country database
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "GeoLite2-Country.mmdb")

_reader: Optional[geoip2.database.Reader] = None

try:
    if os.path.exists(DB_PATH) and os.path.getsize(DB_PATH) > 0:
        _reader = geoip2.database.Reader(DB_PATH)
        print("GeoLite2-Country database loaded successfully.")
    else:
        print(f"Warning: GeoLite2 database file not found at {DB_PATH}. Running without offline GeoIP lookup.")
except Exception as e:
    print(f"Error loading GeoLite2 database: {e}. GeoIP lookups will be disabled.")
    _reader = None

def get_country(ip_address: str) -> Optional[str]:
    """
    Looks up the country name for a given IP address using the offline database.
    Returns None if:
    - The database is not loaded
    - The IP is private/local/invalid
    - The IP is not found in the database
    """
    if not _reader or not ip_address:
        return None
    
    # Fast checks for local IPs
    if ip_address in ("127.0.0.1", "::1", "localhost") or ip_address.startswith("192.168.") or ip_address.startswith("10."):
        return None
        
    try:
        response = _reader.country(ip_address)
        if response and response.country and response.country.name:
            return response.country.name
        return None
    except Exception:
        # Gracefully handle AddressNotFoundError, ValueError, and other lookup issues
        return None
