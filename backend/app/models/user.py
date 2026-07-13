import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    links = relationship("Link", back_populates="user", cascade="all, delete-orphan")
