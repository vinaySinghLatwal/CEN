def test_create_event_operational_gating(client, db_session):
    from src.auth.service import create_user
    from src.users.schemas import UserCreate
    from src.societies.models import Society

    owner = create_user(db_session, UserCreate(name="Owner", email="evowner@cen.app", password="password123"), role="owner")
    
    # Non-operational society (coordinator_count = 1)
    soc_non_op = Society(name="Non Op Society", address="1 NonOp Rd", admin_id=owner.id, coordinator_count=1, key="NONOP-SOC")
    db_session.add(soc_non_op)

    # Operational society (coordinator_count = 2)
    soc_op = Society(name="Op Society", address="2 Op Rd", admin_id=owner.id, coordinator_count=2, key="OP-SOC")
    db_session.add(soc_op)
    db_session.commit()

    coord = create_user(db_session, UserCreate(name="Coord Event", email="coordev@cen.app", password="password123"), role="coordinator")
    coord.is_coordinator = True
    coord.society_id = soc_non_op.id
    db_session.commit()

    login_resp = client.post("/api/v1/auth/login", json={"email": "coordev@cen.app", "password": "password123"})
    token = login_resp.json().get("accessToken") or login_resp.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt to create event in non-operational society -> Fails 403 Forbidden
    event_payload = {"title": "Cleanup Day", "description": "Park cleaning", "startTime": "2026-08-01T10:00:00Z", "endTime": "2026-08-01T12:00:00Z", "volunteersNeeded": 5}
    fail_resp = client.post("/api/v1/events", json=event_payload, headers=headers)
    assert fail_resp.status_code == 403
    assert "Society is not operational" in fail_resp.json()["detail"]

    # Assign coord to operational society -> Succeeds
    coord.society_id = soc_op.id
    db_session.commit()

    succ_resp = client.post("/api/v1/events", json=event_payload, headers=headers)
    assert succ_resp.status_code == 201
    assert succ_resp.json()["title"] == "Cleanup Day"


def test_volunteer_request_and_approval(client, db_session):
    from src.auth.service import create_user
    from src.users.schemas import UserCreate
    from src.societies.models import Society
    from src.events.models import EventItem

    owner = create_user(db_session, UserCreate(name="Owner", email="owner_vol@cen.app", password="password123"), role="owner")
    soc = Society(name="Vol Society", address="3 Vol Rd", admin_id=owner.id, coordinator_count=2, key="VOL-SOC")
    db_session.add(soc)
    db_session.commit()

    coord = create_user(db_session, UserCreate(name="Coord Vol", email="coordvol@cen.app", password="password123"), role="coordinator")
    coord.is_coordinator = True
    coord.society_id = soc.id

    resident = create_user(db_session, UserCreate(name="Resident Vol", email="resvol@cen.app", password="password123"), role="resident")
    resident.society_id = soc.id
    db_session.commit()

    event = EventItem(title="Tree Plantation", description="Planting trees", start_time="2026-08-15T10:00:00Z", end_time="2026-08-15T12:00:00Z", created_by_coordinator_id=coord.id, volunteers_needed=10, volunteers="", society_id=soc.id)
    db_session.add(event)
    db_session.commit()

    # 1. Resident requests to volunteer
    res_login = client.post("/api/v1/auth/login", json={"email": "resvol@cen.app", "password": "password123"})
    res_token = res_login.json().get("accessToken") or res_login.json().get("access_token")
    res_headers = {"Authorization": f"Bearer {res_token}"}

    vol_resp = client.post(f"/api/v1/events/{event.id}/volunteer", headers=res_headers)
    assert vol_resp.status_code == 201
    vr_id = vol_resp.json()["id"]

    # 2. Coordinator approves volunteer request
    coord_login = client.post("/api/v1/auth/login", json={"email": "coordvol@cen.app", "password": "password123"})
    coord_token = coord_login.json().get("accessToken") or coord_login.json().get("access_token")
    coord_headers = {"Authorization": f"Bearer {coord_token}"}

    appr_resp = client.post(f"/api/v1/events/volunteer-requests/{vr_id}/approve", headers=coord_headers)
    assert appr_resp.status_code == 200
    assert appr_resp.json()["status"] == "approved"

    # Verify resident ID is appended to event.volunteers list
    db_session.refresh(event)
    assert resident.id in event.volunteers


def test_volunteer_withdrawal(client, db_session):
    from src.auth.service import create_user
    from src.users.schemas import UserCreate
    from src.societies.models import Society
    from src.events.models import EventItem, VolunteerRequest

    owner = create_user(db_session, UserCreate(name="Owner", email="owner_wdr@cen.app", password="password123"), role="owner")
    soc = Society(name="Wdr Society", address="4 Wdr Rd", admin_id=owner.id, coordinator_count=2, key="WDR-SOC")
    db_session.add(soc)
    db_session.commit()

    resident = create_user(db_session, UserCreate(name="Resident Wdr", email="reswdr@cen.app", password="password123"), role="resident")
    resident.society_id = soc.id
    db_session.commit()

    event = EventItem(title="Book Drive", description="Collecting books", start_time="2026-08-20T10:00:00Z", end_time="2026-08-20T12:00:00Z", created_by_coordinator_id="c1", volunteers_needed=4, volunteers=resident.id, society_id=soc.id)
    db_session.add(event)
    db_session.commit()

    vr = VolunteerRequest(event_id=event.id, event_title=event.title, resident_id=resident.id, resident_name=resident.name, type="self-requested", status="approved")
    db_session.add(vr)
    db_session.commit()

    # Resident withdraws from event
    login_resp = client.post("/api/v1/auth/login", json={"email": "reswdr@cen.app", "password": "password123"})
    token = login_resp.json().get("accessToken") or login_resp.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    wdr_resp = client.post(f"/api/v1/events/volunteer-requests/{vr.id}/withdraw", json={"leaveReason": "Traveling on weekend"}, headers=headers)
    assert wdr_resp.status_code == 200
    assert wdr_resp.json()["status"] == "left"
    assert wdr_resp.json()["leaveReason"] == "Traveling on weekend"

    # Verify resident ID was removed from event.volunteers
    db_session.refresh(event)
    assert resident.id not in event.volunteers

def test_create_event_with_colors(client, db_session):
    from src.auth.service import create_user
    from src.users.schemas import UserCreate
    from src.societies.models import Society

    owner = create_user(db_session, UserCreate(name="Owner", email="colowner@cen.app", password="password123"), role="owner")
    soc = Society(name="Color Society", address="1 Color Rd", admin_id=owner.id, coordinator_count=2, key="COL-SOC")
    db_session.add(soc)
    db_session.commit()

    coord = create_user(db_session, UserCreate(name="Coord Color", email="coordcol@cen.app", password="password123"), role="coordinator")
    coord.is_coordinator = True
    coord.society_id = soc.id
    db_session.commit()

    login_resp = client.post("/api/v1/auth/login", json={"email": "coordcol@cen.app", "password": "password123"})
    token = login_resp.json().get("accessToken") or login_resp.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    event_payload = {
        "title": "Colorful Event", 
        "description": "An event with custom colors", 
        "startTime": "2026-08-01T10:00:00Z", 
        "endTime": "2026-08-01T12:00:00Z", 
        "volunteersNeeded": 5,
        "color": "#ff0000",
        "textColor": "#ffffff"
    }
    
    resp = client.post("/api/v1/events", json=event_payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Colorful Event"
    assert data["color"] == "#ff0000"
    assert data["textColor"] == "#ffffff"
