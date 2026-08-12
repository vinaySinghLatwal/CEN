from typing import List
from sqlalchemy.orm import Session
from datetime import datetime

from src.notices.models import Notice
from src.notices.schemas import NoticeCreate
from src.users.models import User


def list_society_notices(db: Session, society_id: str) -> List[Notice]:
    return (
        db.query(Notice)
        .filter(Notice.society_id == society_id)
        .order_by(Notice.date.desc(), Notice.id.desc())
        .all()
    )


def create_notice(db: Session, user: User, payload: NoticeCreate) -> Notice:
    n = Notice(
        society_id=payload.society_id,
        posted_by_id=user.id,
        posted_by_name=user.name,
        title=payload.title,
        content=payload.content,
        category=payload.category,
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


def delete_notice(db: Session, notice_id: str) -> bool:
    n = db.query(Notice).filter(Notice.id == notice_id).first()
    if n:
        db.delete(n)
        db.commit()
        return True
    return False


def has_posted_today(db: Session, user_id: str) -> bool:
    today_str = datetime.now(datetime.UTC).strftime("%Y-%m-%d")
    n = db.query(Notice).filter(Notice.posted_by_id == user_id, Notice.date == today_str).first()
    return n is not None
