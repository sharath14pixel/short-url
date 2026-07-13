from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.routers import auth, links, analytics, redirect

# Auto-create tables on startup
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"Error creating database tables on startup: {e}")

app = FastAPI(
    title="SmartLink API",
    description="A high-performance URL shortening and analytics platform built with FastAPI.",
    version="1.0.0"
)

# CORS Configuration
# Allows connection from standard React/Next.js dev ports and production frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check route
@app.get("/health", tags=["System"])
def health_check():
    """Simple API health assessment check."""
    return {"status": "healthy", "service": "SmartLink Backend"}

# 1. Register API routers first so their specific paths aren't intercepted
app.include_router(auth.router)
app.include_router(links.router)
app.include_router(analytics.router)

# 2. Register redirect router LAST because it matches root '/{short_code}'
app.include_router(redirect.router)

if __name__ == "__main__":
    import uvicorn
    import os
    # Read port from environment variable, defaulting to 8000
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
