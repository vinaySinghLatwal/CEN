import uuid
from datetime import date
from sqlalchemy import Column, String, Integer, Boolean, Date, ForeignKey
from sqlalchemy.orm import relationship
from src.database import Base


def generate_uuid():
    return f"u-{uuid.uuid4().hex[:8]}"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="resident")  # owner | admin | coordinator | resident
    society_id = Column(String, nullable=True, index=True)
    household_id = Column(String, nullable=True, index=True)
    credit_balance = Column(Integer, nullable=False, default=0)
    joined_date = Column(String, nullable=False, default=lambda: date.today().isoformat())
    id_proof_uploaded = Column(Boolean, nullable=False, default=False)
    id_proof_verified = Column(Boolean, nullable=False, default=False)
    id_proof_url = Column(String, nullable=True)
    is_coordinator = Column(Boolean, nullable=False, default=False)
    avatar_color = Column(String, nullable=True, default="#0ea5e9")
    interests = Column(String, nullable=True)  # Comma-separated or JSON string
    offered_skills_text = Column(String, nullable=True)
    volunteer_interest = Column(String, nullable=True)
    has_completed_survey = Column(Boolean, nullable=False, default=False)


class UserSummary(Base):
    __tablename__ = "user_summaries"
    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id"), unique=True, index=True, nullable=False)
    summary_text = Column(String, nullable=False)
    generated_at = Column(String, nullable=False, default=lambda: date.today().isoformat())
