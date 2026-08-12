import uuid
from datetime import date
from sqlalchemy import Column, String, Integer, ForeignKey
from src.database import Base


def generate_ev_id():
    return f"ev-{uuid.uuid4().hex[:8]}"


def generate_vr_id():
    return f"vr-{uuid.uuid4().hex[:8]}"


class EventItem(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True, default=generate_ev_id, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    start_time = Column(String, nullable=False)  # Stored as ISO format string for SQLite compatibility
    end_time = Column(String, nullable=False)
    created_by_coordinator_id = Column(String, nullable=False, index=True)
    volunteers_needed = Column(Integer, nullable=False, default=1)
    volunteers = Column(String, nullable=False, default="")  # Comma-separated user IDs
    status = Column(String, nullable=False, default="upcoming")  # upcoming | completed
    society_id = Column(String, nullable=False, index=True)
    color = Column(String, nullable=False, default="#dce8fb")
    text_color = Column(String, nullable=False, default="#1e3a6e")


class VolunteerRequest(Base):
    __tablename__ = "volunteer_requests"

    id = Column(String, primary_key=True, default=generate_vr_id, index=True)
    event_id = Column(String, nullable=False, index=True)
    event_title = Column(String, nullable=False)
    resident_id = Column(String, nullable=False, index=True)
    resident_name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # self-requested | coordinator-invited
    status = Column(String, nullable=False, default="pending")  # pending | approved | rejected | left
    leave_reason = Column(String, nullable=True)
