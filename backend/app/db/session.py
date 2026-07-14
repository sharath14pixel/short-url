from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

connect_args = {}
engine_args = {
    "pool_pre_ping": True
}

if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
else:
    # PostgreSQL connection pool tuning for production robustness (e.g. Supabase connection resiliency)
    engine_args.update({
        "pool_size": 20,       # Keep up to 20 connections open in the pool
        "max_overflow": 10,    # Allow up to 10 additional burst connections
        "pool_recycle": 300,   # Recycle idle connections every 5 minutes to prevent dropouts
        "pool_timeout": 30     # Wait up to 30 seconds for a connection from the pool
    })

engine = create_engine(
    settings.DATABASE_URL, 
    connect_args=connect_args,
    **engine_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
