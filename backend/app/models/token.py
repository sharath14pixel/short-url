import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Boolean, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base

class UserRefreshToken(Base):
    __tablename__ = "user_refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    jti: Mapped[str] = mapped_column(String(36), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User")
