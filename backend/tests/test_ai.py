def test_find_nearby_societies(client, db_session):
    from src.auth.service import create_user
    from src.users.schemas import UserCreate
    from src.societies.models import Society

    owner = create_user(db_session, UserCreate(name="Owner", email="aiowner@cen.app", password="password123"), role="owner")
    soc = Society(name="AI Oasis", address="100 MG Road", admin_id=owner.id, capacity=50, key="AI-SOC")
    db_session.add(soc)
    db_session.commit()

    resp = client.post("/api/v1/ai/find-nearby-societies", json={"address": "MG Road area"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["society"]["name"] == "AI Oasis"


def test_chatbot_query(client, db_session):
    from src.auth.service import create_user
    from src.users.schemas import UserCreate

    user = create_user(db_session, UserCreate(name="AI User", email="aiuser@cen.app", password="password123"))
    user.credit_balance = 35
    db_session.commit()

    login_resp = client.post("/api/v1/auth/login", json={"email": "aiuser@cen.app", "password": "password123"})
    token = login_resp.json().get("accessToken") or login_resp.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post("/api/v1/ai/chatbot", json={"message": "What is my credit balance?"}, headers=headers)
    assert resp.status_code == 200
    assert "35 credits" in resp.json()["answer"]


def test_auto_tag(client):
    resp = client.post("/api/v1/ai/auto-tag", json={"text": "Acoustic guitar and music lessons"})
    assert resp.status_code == 200
    data = resp.json()
    assert "music" in data["category"].lower()
    assert any("music" in t.lower() or "lesson" in t.lower() or "education" in t.lower() for t in data["tags"]) or len(data["tags"]) > 0


def test_categorize_complaint(client):
    resp = client.post("/api/v1/ai/categorize-complaint", json={"text": "Dangerous threat and safety issue in garden"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["priority"] == "high"


def test_verify_id_proof(client, db_session):
    from src.auth.service import create_user
    from src.users.schemas import UserCreate

    user = create_user(db_session, UserCreate(name="Doc User", email="docuser@cen.app", password="password123"))
    login_resp = client.post("/api/v1/auth/login", json={"email": "docuser@cen.app", "password": "password123"})
    token = login_resp.json().get("accessToken") or login_resp.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    # Upload ID proof
    upload_resp = client.post("/api/v1/users/me/id-proof", json={"idProofUrl": "https://example.com/id.jpg"}, headers=headers)
    assert upload_resp.status_code == 200
    assert upload_resp.json()["idProofUploaded"] is True

    # AI Document Vision Verification
    ai_resp = client.post("/api/v1/ai/verify-id-proof", json={"imageUrl": "https://example.com/id.jpg", "userName": "Doc User"}, headers=headers)
    assert ai_resp.status_code == 200
    assert "isValidId" in ai_resp.json()

def test_check_event_clash(client, db_session):
    from src.auth.service import create_user
    from src.users.schemas import UserCreate
    from src.societies.models import Society
    from src.events.models import EventItem

    owner = create_user(db_session, UserCreate(name="Owner", email="clashowner@cen.app", password="password123"), role="owner")
    soc = Society(name="Clash Society", address="1 Clash Rd", admin_id=owner.id, coordinator_count=2, key="CLASH-SOC")
    db_session.add(soc)
    db_session.commit()
    
    # Add an existing event
    event = EventItem(
        title="Existing Event",
        description="This is an existing event",
        start_time="2026-08-01T10:00:00Z",
        end_time="2026-08-01T12:00:00Z",
        created_by_coordinator_id=owner.id,
        volunteers_needed=5,
        volunteers="",
        society_id=soc.id
    )
    db_session.add(event)
    db_session.commit()

    coord = create_user(db_session, UserCreate(name="Coord Clash", email="coordclash@cen.app", password="password123"), role="coordinator")
    coord.is_coordinator = True
    coord.society_id = soc.id
    db_session.commit()

    login_resp = client.post("/api/v1/auth/login", json={"email": "coordclash@cen.app", "password": "password123"})
    token = login_resp.json().get("accessToken") or login_resp.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    clash_payload = {
        "title": "New Event", 
        "description": "An event that clashes", 
        "startTime": "2026-08-01T11:00:00Z", 
        "endTime": "2026-08-01T13:00:00Z", 
        "societyId": soc.id
    }
    
    resp = client.post("/api/v1/ai/check-event-clash", json=clash_payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "hasClash" in data
    assert "reason" in data

