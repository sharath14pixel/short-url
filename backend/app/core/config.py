from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional, List

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./smartlink.db"
    
    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def convert_postgres_prefix(cls, v: str) -> str:
        if isinstance(v, str) and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REDIS_URL: Optional[str] = None
    
    # CORS Origins allowed to access the API
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ]
    
    # Rate Limiting & Security Config
    RATE_LIMIT_ANONYMOUS_HOUR: int = 20
    RATE_LIMIT_USER_HOUR: int = 100
    
    # Restricted short codes/aliases to avoid route conflict
    RESTRICTED_WORDS: List[str] = [
        "admin", "api", "login", "signup", "logout", "auth", "links",
        "redirect", "analytics", "clicks", "stats", "static", "docs",
        "redoc", "openapi.json", "favicon.ico", "robots.txt", "health",
        "user", "users", "dashboard", "settings"
    ]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
