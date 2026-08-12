import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, ForeignKey, DateTime
from src.database import Base


class Notice(Base):
    __tablename__ = "notices"

    id = Column(String, primary_key=True, default=lambda: f"n-{uuid.uuid4().hex[:8]}")
    society_id = Column(String, ForeignKey("societies.id"), nullable=False)
    posted_by_id = Column(String, ForeignKey("users.id"), nullable=False)
    posted_by_name = Column(String, nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String, default="General")
    date = Column(String, default=lambda: datetime.now(datetime.UTC).strftime("%Y-%m-%d"))
