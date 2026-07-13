import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base

class Click(Base):
    __tablename__ = "clicks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    link_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("links.id", ondelete="CASCADE"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=True)  # Supports IPv4 and IPv6 lengths
    user_agent: Mapped[str] = mapped_column(String(500), nullable=True)
    referrer: Mapped[str] = mapped_column(String(500), nullable=True)
    country: Mapped[str] = mapped_column(String(100), nullable=True)

    # Relationships
    link = relationship("Link", back_populates="clicks")
