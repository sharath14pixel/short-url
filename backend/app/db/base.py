# Import all models here so that they are registered on the Base metadata
# for Alembic migrations.
from app.db.base_class import Base  # noqa
from app.models.user import User  # noqa
from app.models.link import Link  # noqa
from app.models.click import Click  # noqa
