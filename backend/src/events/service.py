from typing import List
from sqlalchemy.orm import Session

from src.events.models import EventItem, VolunteerRequest
from src.events.schemas import EventCreate
from src.exceptions import APIException, ForbiddenException, NotFoundException
from src.societies import service as soc_service
from src.users.models import User


def list_events(db: Session, society_id: str) -> List[EventItem]:
    return db.query(EventItem).filter(EventItem.society_id == society_id).all()


def create_event(db: Session, coordinator: User, event_in: EventCreate) -> EventItem:
    if not coordinator.society_id:
        raise APIException(status_code=400, detail="Coordinator is not assigned to any society.", code="NO_SOCIETY")

    soc = soc_service.get_society_by_id(db, coordinator.society_id)
    if not soc_service.is_society_operational(soc):
        raise ForbiddenException("Society is not operational until at least 2 coordinators are registered.")

    overlapping_event = db.query(EventItem).filter(
        EventItem.society_id == coordinator.society_id,
        EventItem.start_time < event_in.end_time,
        EventItem.end_time > event_in.start_time
    ).first()

    if overlapping_event:
        raise APIException(
            status_code=400,
            detail=f"This event overlaps with an existing event: {overlapping_event.title}",
            code="EVENT_OVERLAP"
        )

    event = EventItem(
        title=event_in.title.strip(),
        description=event_in.description.strip(),
        start_time=event_in.start_time,
        end_time=event_in.end_time,
        created_by_coordinator_id=coordinator.id,
        volunteers_needed=event_in.volunteers_needed,
        volunteers="",
        status="upcoming",
        society_id=coordinator.society_id,
        color=event_in.color,
        text_color=event_in.text_color,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def list_volunteer_requests_for_event(db: Session, event_id: str) -> List[VolunteerRequest]:
    return db.query(VolunteerRequest).filter(VolunteerRequest.event_id == event_id).all()


def request_to_volunteer(db: Session, resident: User, event_id: str) -> VolunteerRequest:
    event = db.query(EventItem).filter(EventItem.id == event_id).first()
    if not event:
        raise NotFoundException(f"Event with ID '{event_id}' not found")

    existing = (
        db.query(VolunteerRequest)
        .filter(VolunteerRequest.event_id == event_id, VolunteerRequest.resident_id == resident.id)
        .first()
    )
    if existing:
        return existing

    vr = VolunteerRequest(
        event_id=event.id,
        event_title=event.title,
        resident_id=resident.id,
        resident_name=resident.name,
        type="self-requested",
        status="pending",
    )
    db.add(vr)
    db.commit()
    db.refresh(vr)
    return vr


def invite_volunteer(
    db: Session, coordinator: User, event_id: str, resident_id: str
) -> VolunteerRequest:
    event = db.query(EventItem).filter(EventItem.id == event_id).first()
    if not event:
        raise NotFoundException(f"Event with ID '{event_id}' not found")

    resident = db.query(User).filter(User.id == resident_id).first()
    if not resident:
        raise NotFoundException(f"Resident user with ID '{resident_id}' not found")

    existing = (
        db.query(VolunteerRequest)
        .filter(VolunteerRequest.event_id == event_id, VolunteerRequest.resident_id == resident_id)
        .first()
    )
    if existing:
        return existing

    vr = VolunteerRequest(
        event_id=event.id,
        event_title=event.title,
        resident_id=resident.id,
        resident_name=resident.name,
        type="coordinator-invited",
        status="pending",
    )
    db.add(vr)
    db.commit()
    db.refresh(vr)
    return vr


def approve_volunteer_request(db: Session, coordinator: User, request_id: str) -> VolunteerRequest:
    vr = db.query(VolunteerRequest).filter(VolunteerRequest.id == request_id).first()
    if not vr:
        raise NotFoundException(f"Volunteer request with ID '{request_id}' not found")

    vr.status = "approved"

    # Append to event volunteers list
    event = db.query(EventItem).filter(EventItem.id == vr.event_id).first()
    if event:
        current_list = [u.strip() for u in event.volunteers.split(",") if u.strip()] if event.volunteers else []
        if vr.resident_id not in current_list:
            current_list.append(vr.resident_id)
            event.volunteers = ",".join(current_list)

    db.commit()
    db.refresh(vr)
    return vr


def reject_volunteer_request(db: Session, coordinator: User, request_id: str) -> VolunteerRequest:
    vr = db.query(VolunteerRequest).filter(VolunteerRequest.id == request_id).first()
    if not vr:
        raise NotFoundException(f"Volunteer request with ID '{request_id}' not found")

    vr.status = "rejected"
    db.commit()
    db.refresh(vr)
    return vr


def withdraw_volunteer(
    db: Session, resident: User, request_id: str, leave_reason: str = None
) -> VolunteerRequest:
    vr = db.query(VolunteerRequest).filter(VolunteerRequest.id == request_id).first()
    if not vr:
        raise NotFoundException(f"Volunteer request with ID '{request_id}' not found")

    vr.status = "left"
    if leave_reason:
        vr.leave_reason = leave_reason.strip()

    event = db.query(EventItem).filter(EventItem.id == vr.event_id).first()
    if event and event.volunteers:
        current_list = [u.strip() for u in event.volunteers.split(",") if u.strip()]
        if resident.id in current_list:
            current_list.remove(resident.id)
            event.volunteers = ",".join(current_list)

    db.commit()
    db.refresh(vr)
    return vr
