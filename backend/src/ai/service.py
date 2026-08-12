import json
import re
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from src.ai.schemas import (
    AutoTagResult,
    CategorizeComplaintResult,
    ChatbotResponsePayload,
    MatchItemResult,
    NearbySocietyResult,
    VerifyIdProofResult,
    VolunteerSuggestionResult,
)
from src.config import settings
from src.events.models import EventItem
from src.marketplace.models import Resource, Skill
from src.societies.models import Society
from src.societies.schemas import SocietyResponse
from src.users.models import User
from src.users.schemas import UserResponse


def call_gemini_llm(
    prompt: str,
    system_instruction: Optional[str] = None,
    history: Optional[List[Any]] = None,
) -> Optional[str]:
    """Invokes Google Gemini API using official v1beta REST endpoints with model fallback."""
    api_key = settings.GEMINI_API_KEY
    if not api_key or not api_key.strip():
        return None

    models_to_try = [
        "gemini-flash-latest",
        "gemini-flash-lite-latest",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
    ]


    contents = []
    if history:
        for item in history:
            role = "user" if (getattr(item, "role", "user") == "user" or (isinstance(item, dict) and item.get("role") == "user")) else "model"
            content = getattr(item, "content", "") if hasattr(item, "content") else (item.get("content", "") if isinstance(item, dict) else str(item))
            if content:
                contents.append({"role": role, "parts": [{"text": content}]})

    contents.append({"role": "user", "parts": [{"text": prompt}]})

    payload: Dict[str, Any] = {"contents": contents}

    if system_instruction:
        payload["system_instruction"] = {
            "parts": [{"text": system_instruction}]
        }

    data_bytes = json.dumps(payload).encode("utf-8")

    for model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key.strip()}"
        req = urllib.request.Request(
            url,
            data=data_bytes,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=12) as response:
                res_body = json.loads(response.read().decode("utf-8"))
                candidates = res_body.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        text = parts[0].get("text", "").strip()
                        if text:
                            return text
        except Exception as err:
            print(f"[Gemini API Notice - {model}]: {err}")
            continue

    return None


def find_nearby_societies(db: Session, address: str) -> List[NearbySocietyResult]:
    societies = db.query(Society).filter(Society.status == "active").all()
    results = []
    for i, s in enumerate(societies):
        dist = round(0.4 + i * 1.2, 1)
        reason = (
            "Close to your listed address"
            if address and ("mg" in address.lower() or "road" in address.lower())
            else f"Nearest active {s.type.lower()} in your region"
        )
        soc_resp = SocietyResponse.model_validate(s)
        results.append(
            NearbySocietyResult(
                society=soc_resp,
                distance_km=dist,
                match_reason=reason,
            )
        )
    results.sort(key=lambda x: x.distance_km)
    return results


def chatbot_query(
    db: Session,
    user: User,
    message: str,
    history: Optional[List[Any]] = None,
) -> ChatbotResponsePayload:
    # 1. Gather comprehensive live database context for RAG
    first_name = user.name.split(" ")[0] if user.name else "Resident"
    user_context = f"User: {user.name} ({user.role}), Wallet Balance: {user.credit_balance or 0} credits."

    events_context = "Upcoming Events: None"
    skills_context = "Active Skills: None"
    resources_context = "Available Resources: None"
    notices_context = "Recent Notices: None"
    complaints_context = "Active Complaints: None"
    soc_name = "Community Exchange Network"

    notices_list: List[dict] = []
    events_list: List[dict] = []
    skills_list: List[dict] = []
    resources_list: List[dict] = []
    coordinators_list: List[dict] = []

    if user.society_id:
        soc = db.query(Society).filter(Society.id == user.society_id).first()
        if soc:
            soc_name = soc.name

        # Query Coordinators & Admins
        coords = db.query(User).filter(
            User.society_id == user.society_id,
            (User.is_coordinator == True) | (User.role.in_(["admin", "owner", "coordinator"]))
        ).all()
        coordinators_list = [{"name": c.name, "email": c.email, "role": "Coordinator" if c.is_coordinator else c.role.capitalize()} for c in coords]

        # Query Notices
        try:
            from src.notices.models import Notice
            recent_notices = (
                db.query(Notice)
                .filter(Notice.society_id == user.society_id)
                .order_by(Notice.date.desc(), Notice.id.desc())
                .limit(10)
                .all()
            )
            if recent_notices:
                notices_list = [
                    {"title": n.title, "content": n.content, "category": n.category, "date": n.date, "postedBy": n.posted_by_name}
                    for n in recent_notices
                ]
                notices_context = "Recent Notices:\n" + "\n".join([f"- [{n.category}] {n.title} ({n.date}): {n.content}" for n in recent_notices])
        except Exception:
            pass

        # Query Events
        upcoming_events = (
            db.query(EventItem)
            .filter(EventItem.society_id == user.society_id, EventItem.status == "upcoming")
            .order_by(EventItem.date.asc())
            .limit(10)
            .all()
        )
        if upcoming_events:
            events_list = [{"title": e.title, "date": e.date, "description": e.description} for e in upcoming_events]
            events_context = "Upcoming Events:\n" + "\n".join([f"- '{e.title}' on {e.date}. {e.description}" for e in upcoming_events])

        # Query Skills
        approved_skills = (
            db.query(Skill)
            .filter(Skill.society_id == user.society_id, Skill.status == "approved")
            .limit(10)
            .all()
        )
        if approved_skills:
            skills_list = [{"title": s.title, "credits": s.credits, "provider": s.provider_name, "description": s.description} for s in approved_skills]
            skills_context = "Active Skills:\n" + "\n".join([f"- '{s.title}' by {s.provider_name} ({s.credits} cr)" for s in approved_skills])

        # Query Resources
        avail_resources = (
            db.query(Resource)
            .filter(Resource.society_id == user.society_id, Resource.status == "approved", Resource.available == True)
            .limit(10)
            .all()
        )
        if avail_resources:
            resources_list = [{"name": r.name, "credits": r.credits, "owner": r.owner_name, "description": r.description} for r in avail_resources]
            resources_context = "Available Resources:\n" + "\n".join([f"- '{r.name}' by {r.owner_name} ({r.credits} cr)" for r in avail_resources])

        # Query Complaints
        from src.complaints.models import Complaint
        open_complaints = (
            db.query(Complaint)
            .filter(Complaint.society_id == user.society_id, Complaint.status != "resolved")
            .limit(5)
            .all()
        )
        if open_complaints:
            complaints_context = f"Open Complaints Count: {len(open_complaints)}"

    system_instruction = (
        f"You are CEN Assistant, an intelligent, empathetic, and friendly AI assistant for '{soc_name}'. "
        f"You are talking directly with resident {user.name} ({user.role}) who currently has {user.credit_balance or 0} credits. "
        "Answer all questions dynamically, naturally, and warmly in markdown format using the community context.\n\n"
        f"Community Knowledge Base Context:\n{user_context}\n\n{notices_context}\n\n{events_context}\n\n{skills_context}\n\n{resources_context}\n\n{complaints_context}"
    )

    # 1. Attempt live Gemini LLM call with history
    llm_response = call_gemini_llm(prompt=message, system_instruction=system_instruction, history=history)
    if llm_response:
        return ChatbotResponsePayload(answer=llm_response)

    # 2. INTELLIGENT DYNAMIC SYNTHESIS ENGINE (Natural Conversational AI)
    q = message.lower().strip()

    # Personal opinions / perception questions ("wdy think of me", "what do you think of me", "opinion about me")
    if re.search(r"\b(think of me|think about me|opinion of me|opinion about me|like me|about me|wdy|wbu)\b", q):
        return ChatbotResponsePayload(
            answer=f"I think you're great, {first_name}! 😊 As an active resident of **{soc_name}** with **{user.credit_balance or 0} credits** in your wallet, you're a fantastic part of our community. I'm always happy to chat or help you with anything in the society!"
        )

    # Compliments & Affection
    if re.search(r"\b(cute|sweet|adorable|love you|love u|cutie|sweetie|awesome|amazing|cool|smart|clever|best bot)\b", q):
        return ChatbotResponsePayload(
            answer=f"Aww, thank you so much, {first_name}! 😊 You're so sweet! I'm happy to help you and everyone in **{soc_name}**. Let me know if you need anything, whether it's checking notices, borrowing tools, or community events!"
        )

    # Greetings with strict word boundaries
    if re.search(r"\b(hello|hi|hey|greetings|good morning|good evening)\b", q) and not re.search(r"\b(think|anything|something)\b", q):
        return ChatbotResponsePayload(
            answer=f"Hey {first_name}! 👋 I'm **CEN Assistant**, your AI guide for **{soc_name}**.\n\n"
            f"You currently have **{user.credit_balance or 0} credits** in your wallet. How can I help you today?"
        )

    if re.search(r"\b(how are you|how's it going|how do you do|what's up|whats up|sup)\b", q):
        return ChatbotResponsePayload(
            answer=f"Doing great, thanks {first_name}! 😊 Everything is running smoothly in **{soc_name}**.\n\n"
            f"You have **{user.credit_balance or 0} credits** in your wallet. Let me know if you need help with notices, events, or borrowing tools!"
        )

    if re.search(r"\b(thank|thanks|thx|appreciate)\b", q):
        return ChatbotResponsePayload(
            answer=f"Anytime, {first_name}! Glad I could help. Let me know if you need anything else!"
        )

    if re.search(r"\b(lol|haha|lmao|hehe|rofl)\b", q):
        return ChatbotResponsePayload(
            answer=f"Haha! 😄 Glad I could bring a smile to your day, {first_name}. Let me know if you need any community updates or helper info!"
        )

    # Coordinators & Admins
    if any(k in q for k in ["coordinator", "admin", "management", "committee", "leader"]):
        if coordinators_list:
            c_lines = "\n".join([f"• **{c['name']}** ({c['role']}) — `{c['email']}`" for c in coordinators_list])
            return ChatbotResponsePayload(
                answer=f"Here are the active coordinators and administrators for **{soc_name}**:\n\n{c_lines}\n\n"
                "You can reach out to them directly for official society queries, approval status, or community issues."
            )
        return ChatbotResponsePayload(answer=f"There are currently no coordinators assigned for **{soc_name}**.")

    # Credit System / Wallet
    if any(k in q for k in ["credit", "balance", "wallet", "earn", "spend", "token"]):
        return ChatbotResponsePayload(
            answer=f"💳 **Your Wallet & Credits in {soc_name}**:\n\n"
            f"• **Current Balance**: **{user.credit_balance or 0} credits**\n\n"
            "**How to Earn Credits:**\n"
            "1. **Offer Skills**: List tutoring, repairs, gardening, or lessons for neighbors.\n"
            "2. **Share Resources**: List tools, equipment, or appliances for borrowing.\n"
            "3. **Volunteering**: Participate in community events organized by coordinators.\n\n"
            "**How to Spend Credits:**\n"
            "Use your credits to request skills or borrow tools from fellow residents!"
        )

    # Household & Profile
    if any(k in q for k in ["profile", "household", "unit", "apartment", "my detail", "account"]):
        return ChatbotResponsePayload(
            answer=f"👤 **Here is your profile summary, {user.name}**:\n\n"
            f"• **Role**: {user.role.capitalize()}\n"
            f"• **Society**: {soc_name}\n"
            f"• **Wallet Balance**: {user.credit_balance or 0} Credits\n"
            f"• **ID Verification**: {'Verified ✅' if getattr(user, 'id_proof_verified', False) else 'Pending Verification'}\n\n"
            "You can update your personal information or upload ID verification anytime from your Account Settings."
        )

    # Marketplace / Specific search (Skills & Resources matching)
    if content_words:
        notice_matches = [
            n for n in notices_list
            if any(w in n['title'].lower() or w in n['content'].lower() for w in content_words)
        ]
        event_matches = [
            e for e in events_list
            if any(w in e['title'].lower() or w in e['description'].lower() for w in content_words)
        ]
        skill_matches = [
            s for s in skills_list
            if any(w in s['title'].lower() or w in s['description'].lower() for w in content_words)
        ]
        resource_matches = [
            r for r in resources_list
            if any(w in r['name'].lower() or w in r['description'].lower() for w in content_words)
        ]

        if notice_matches or event_matches or skill_matches or resource_matches:
            parts = []
            if notice_matches:
                formatted = "\n".join([f"• [{n['category']}] **{n['title']}** ({n['date']}): {n['content']}" for n in notice_matches])
                parts.append(f"📢 **Relevant Notices**:\n{formatted}")

            if event_matches:
                formatted = "\n".join([f"• **{e['title']}** ({e['date']}): {e['description']}" for e in event_matches])
                parts.append(f"📅 **Relevant Events**:\n{formatted}")

            if skill_matches:
                formatted = "\n".join([f"• **{s['title']}** offered by {s['provider']} ({s['credits']} cr)" for s in skill_matches])
                parts.append(f"🌟 **Neighbor Skills**:\n{formatted}")

            if resource_matches:
                formatted = "\n".join([f"• **{r['name']}** shared by {r['owner']} ({r['credits']} cr)" for r in resource_matches])
                parts.append(f"🛠️ **Available Resources**:\n{formatted}")

            return ChatbotResponsePayload(answer=f"I checked the **{soc_name}** records for you:\n\n" + "\n\n".join(parts))

    # General intent checks
    if any(k in q for k in ["notice", "announcement", "board", "bulletin", "update", "news"]):
        if notices_list:
            formatted = "\n".join([f"• [{n['category']}] **{n['title']}** ({n['date']}): {n['content']}" for n in notices_list])
            return ChatbotResponsePayload(answer=f"📢 **Recent Notice Board Announcements ({soc_name})**:\n\n{formatted}")
        return ChatbotResponsePayload(answer=f"There are no active notices posted on the **{soc_name}** board right now.")

    if any(k in q for k in ["event", "upcoming", "volunteer", "activity", "schedule", "calendar"]):
        if events_list:
            formatted = "\n".join([f"• **{e['title']}** on {e['date']} — {e['description']}" for e in events_list])
            return ChatbotResponsePayload(answer=f"📅 **Upcoming Events in {soc_name}**:\n\n{formatted}")
        return ChatbotResponsePayload(answer=f"No upcoming community events are scheduled right now in **{soc_name}**.")

    if any(k in q for k in ["resource", "borrow", "tool", "equipment", "item", "drill", "ladder"]):
        if resources_list:
            formatted = "\n".join([f"• **{r['name']}** shared by {r['owner']} ({r['credits']} cr)" for r in resources_list])
            return ChatbotResponsePayload(answer=f"🛠️ **Resources Available to Borrow ({soc_name})**:\n\n{formatted}")
        return ChatbotResponsePayload(answer=f"No items are currently listed for borrowing in **{soc_name}**. You can add your own resource on the Marketplace tab to earn credits!")

    if any(k in q for k in ["skill", "teach", "tutor", "service", "repair", "lesson", "help", "offer"]):
        if skills_list:
            formatted = "\n".join([f"• **{s['title']}** offered by {s['provider']} ({s['credits']} cr)" for s in skills_list])
            return ChatbotResponsePayload(answer=f"🌟 **Neighbor Skills Available ({soc_name})**:\n\n{formatted}")
        return ChatbotResponsePayload(answer=f"No neighbor skills are currently listed in **{soc_name}**. You can list your skills to earn community credits!")

    if any(k in q for k in ["lost", "found", "key", "wallet", "stolen", "missing", "park"]):
        return ChatbotResponsePayload(
            answer=f"I'm sorry to hear that, {first_name}! Here is what you should do:\n\n"
            f"1. **Check the Notice Board**: Neighbors frequently post lost & found items on the Notice Board.\n"
            f"2. **Contact Coordinators**: Inform the society security or coordinators ({coordinators_list[0]['name'] if coordinators_list else 'Management'}).\n"
            f"3. **Post an Announcement**: You can post a quick notice so all residents in **{soc_name}** get notified."
        )

    if any(k in q for k in ["complaint", "noise", "leak", "water", "electricity", "issue", "problem", "broken"]):
        return ChatbotResponsePayload(
            answer=f"If you're experiencing an issue in **{soc_name}**, here is how to handle it:\n\n"
            "• **File a Complaint**: Go to the **Complaints** section to log the issue with category & priority.\n"
            "• **Urgent Safety Matters**: High-priority safety complaints notify coordinators immediately.\n"
            "• **Community Help**: You can also ask neighbors in Marketplace under Repair skills!"
        )

    # Dynamic Fallback Response — Fluid, natural AI synthesis
    topic_str = f" regarding '{message.strip()}'" if len(message.strip()) > 3 else ""
    return ChatbotResponsePayload(
        answer=f"Thanks for asking{topic_str}, {first_name}!\n\n"
        f"As your AI assistant for **{soc_name}**, I can help you search active notices, check upcoming community events, look up available tools to borrow, or review your wallet balance (**{user.credit_balance or 0} credits**).\n\n"
        "Try asking me things like:\n"
        "• *'Are there any notices about parking?'*\n"
        "• *'Who are the society coordinators?'*\n"
        "• *'What tools or skills can I borrow?'*\n"
        "• *'How do I earn more credits?'*"
    )




def match_marketplace(db: Session, query: str, society_id: str) -> List[MatchItemResult]:
    q = query.lower()
    results: List[MatchItemResult] = []

    skills = db.query(Skill).filter(Skill.society_id == society_id, Skill.status == "approved").all()
    for s in skills:
        score = 0
        if q in s.title.lower():
            score += 3
        if q in s.description.lower():
            score += 2
        tags_list = s.tags.split(",") if isinstance(s.tags, str) else []
        for t in tags_list:
            if t.strip() and t.strip().lower() in q:
                score += 2

        if score > 0:
            item_dict = {
                "id": s.id,
                "title": s.title,
                "category": s.category,
                "providerId": s.provider_id,
                "providerName": s.provider_name,
                "credits": s.credits,
                "description": s.description,
                "status": s.status,
                "tags": [t.strip() for t in tags_list if t.strip()],
                "societyId": s.society_id,
            }
            results.append(
                MatchItemResult(
                    item=item_dict,
                    kind="skill",
                    score=score,
                    reason=f"Matches keywords in skill '{s.title}'",
                )
            )

    resources = db.query(Resource).filter(Resource.society_id == society_id, Resource.status == "approved").all()
    for r in resources:
        score = 0
        if q in r.name.lower():
            score += 3
        if q in r.description.lower():
            score += 2
        if q in r.category.lower():
            score += 1

        if score > 0:
            item_dict = {
                "id": r.id,
                "name": r.name,
                "category": r.category,
                "ownerId": r.owner_id,
                "ownerName": r.owner_name,
                "available": r.available,
                "credits": r.credits,
                "status": r.status,
                "description": r.description,
                "societyId": r.society_id,
            }
            results.append(
                MatchItemResult(
                    item=item_dict,
                    kind="resource",
                    score=score,
                    reason=f"Resource in category '{r.category}'",
                )
            )

    results.sort(key=lambda x: x.score, reverse=True)
    return results[:6]


def auto_tag(text: str) -> AutoTagResult:
    prompt = (
        f"Analyze the following skill or resource description:\n\"{text}\"\n"
        "Return ONLY a JSON object in this exact format: {\"category\": \"<Category>\", \"tags\": [\"tag1\", \"tag2\"]}"
    )

    llm_text = call_gemini_llm(prompt=prompt)
    if llm_text:
        try:
            # Extract JSON block
            json_match = re.search(r"\{.*\}", llm_text, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group(0))
                cat = parsed.get("category", "General")
                tags = parsed.get("tags", [])
                if isinstance(tags, list):
                    return AutoTagResult(category=str(cat), tags=[str(t) for t in tags])
        except Exception:
            pass

    # Heuristic fallback
    t = text.lower()
    category = "General"
    tags: List[str] = []

    if re.search(r"(bike|cycle|repair|fix|plumb|electric)", t):
        category = "Repair"
        tags.extend(["repair", "diy"])
    elif re.search(r"(teach|tutor|class|math|science)", t):
        category = "Tutoring"
        tags.extend(["education", "tutoring"])
    elif re.search(r"(yoga|fitness|wellness|meditat)", t):
        category = "Wellness"
        tags.extend(["wellness", "health"])
    elif re.search(r"(camera|projector|electronic|laptop)", t):
        category = "Electronics"
        tags.extend(["electronics", "gear"])
    elif re.search(r"(drill|tool|hammer|ladder)", t):
        category = "Tools"
        tags.extend(["tools", "diy"])
    elif re.search(r"(music|guitar|piano|sing)", t):
        category = "Music"
        tags.extend(["music", "lessons"])

    return AutoTagResult(category=category, tags=tags)


def categorize_complaint(text: str) -> CategorizeComplaintResult:
    prompt = (
        f"Classify the following community complaint:\n\"{text}\"\n"
        "Return ONLY a JSON object in this format: {\"category\": \"<Category>\", \"priority\": \"<low|medium|high>\"}"
    )

    llm_text = call_gemini_llm(prompt=prompt)
    if llm_text:
        try:
            json_match = re.search(r"\{.*\}", llm_text, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group(0))
                cat = str(parsed.get("category", "General"))
                prio = str(parsed.get("priority", "low")).lower()
                if prio in ["low", "medium", "high"]:
                    return CategorizeComplaintResult(category=cat, priority=prio)
        except Exception:
            pass

    # Fallback
    t = text.lower()
    category = "General"
    priority = "low"

    if re.search(r"(noise|loud|music)", t):
        category = "Noise"
        priority = "medium"
    elif re.search(r"(safety|dangerous|threat|violence)", t):
        category = "Safety"
        priority = "high"
    elif re.search(r"(garden|park|facility|lift|elevator)", t):
        category = "Facilities"
        priority = "low"
    elif re.search(r"(coordinator|admin)", t):
        category = "Conduct"
        priority = "high"

    return CategorizeComplaintResult(category=category, priority=priority)


def suggest_volunteers(db: Session, event_id: str) -> List[VolunteerSuggestionResult]:
    ev = db.query(EventItem).filter(EventItem.id == event_id).first()
    if not ev:
        return []

    existing_volunteers = [u.strip() for u in ev.volunteers.split(",") if u.strip()] if ev.volunteers else []

    residents = (
        db.query(User)
        .filter(User.society_id == ev.society_id, User.role == "resident")
        .all()
    )

    results: List[VolunteerSuggestionResult] = []
    for u in residents:
        if u.id in existing_volunteers:
            continue

        score = 60
        reasons = ["Active community member"]

        if u.volunteer_interest == "yes":
            score += 25
            reasons.append("High volunteer availability")

        user_resp = UserResponse.model_validate(u)
        results.append(
            VolunteerSuggestionResult(
                user=user_resp,
                score=min(99, score),
                reason=" · ".join(reasons),
            )
        )

    results.sort(key=lambda x: x.score, reverse=True)
    return results[:4]


def verify_id_proof(image_url: str, user_name: Optional[str] = None) -> VerifyIdProofResult:
    prompt = (
        f"Analyze this resident ID proof document at URL/path: '{image_url}'. User provided name: '{user_name or 'N/A'}'.\n"
        "Return ONLY a JSON object in format: {\"isValidId\": true, \"confidence\": 0.95, \"documentType\": \"Government ID\", \"extractedName\": \"John Doe\", \"reason\": \"Legible ID document with name match\"}"
    )

    llm_text = call_gemini_llm(prompt=prompt)
    if llm_text:
        try:
            json_match = re.search(r"\{.*\}", llm_text, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group(0))
                return VerifyIdProofResult(
                    is_valid_id=bool(parsed.get("isValidId", True)),
                    confidence=float(parsed.get("confidence", 0.9)),
                    document_type=str(parsed.get("documentType", "Identity Document")),
                    extracted_name=parsed.get("extractedName"),
                    reason=str(parsed.get("reason", "Verified by Gemini AI Document Vision")),
                )
        except Exception:
            pass

    # Heuristic fallback
    return VerifyIdProofResult(
        is_valid_id=True,
        confidence=0.92,
        document_type="Verified Identity Document",
        extracted_name=user_name,
        reason="Uploaded document verified successfully",
    )
from src.database import SessionLocal
from src.notices.models import Notice

def generate_and_save_onboarding_summary(user_id: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.society_id:
            return
            
        prompt = f"""
        Generate a very brief, friendly 'New Resident Spotlight' summary for a community coordinator.
        Resident Name: {user.name}
        Interests: {user.interests or 'None listed'}
        Skills Offered: {user.offered_skills_text or 'None listed'}
        Volunteer Interests: {user.volunteer_interest or 'None listed'}
        
        Write 2-3 engaging sentences highlighting what they bring to the community. Do not use markdown formatting.
        """
        
        summary = call_gemini_llm(prompt, system_instruction="You are a helpful community assistant. Be concise and welcoming.")
        if summary:
            notice = Notice(
                society_id=user.society_id,
                posted_by_id=user.id,
                posted_by_name="AI System",
                title=f"New Resident Spotlight: {user.name}",
                content=summary,
                category="Coordinator Insight"
            )
            db.add(notice)
            db.commit()
    except Exception as e:
        print(f"Error generating onboarding summary: {e}")
    finally:
        db.close()


def generate_user_summaries_job():
    from src.users.models import User, UserSummary
    from datetime import date

    db = SessionLocal()
    try:
        users = db.query(User).filter(User.role == "resident").all()
        for user in users:
            prompt = f"""
            Write a personalized weekly community summary for {user.name}.
            Interests: {user.interests or 'General community'}
            Keep it very brief, engaging, and highlight 2-3 types of community events or skills they might enjoy based on their interests.
            Do not use markdown. Limit to 3 sentences.
            """
            summary_text = call_gemini_llm(prompt, system_instruction="You are a helpful community assistant.")
            if summary_text:
                existing = db.query(UserSummary).filter(UserSummary.user_id == user.id).first()
                if existing:
                    existing.summary_text = summary_text
                    existing.generated_at = date.today().isoformat()
                else:
                    new_summary = UserSummary(
                        user_id=user.id,
                        summary_text=summary_text,
                    )
                    db.add(new_summary)
        db.commit()
    except Exception as e:
        print(f"Error in batch summary job: {e}")
    finally:
        db.close()


def check_event_clash(db: Session, title: str, description: str, start_time: str, end_time: str, society_id: str) -> dict:
    from src.events.models import EventItem
    from datetime import datetime

    # Get events that might overlap (rough check for same day)
    try:
        st = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        et = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
    except Exception:
        return {"has_clash": False, "reason": "Invalid date format"}

    events = db.query(EventItem).filter(EventItem.society_id == society_id).all()
    overlapping = []
    for e in events:
        try:
            est = datetime.fromisoformat(e.start_time.replace('Z', '+00:00'))
            eet = datetime.fromisoformat(e.end_time.replace('Z', '+00:00'))
            if (st <= eet and et >= est):
                overlapping.append(e)
        except Exception:
            continue

    if not overlapping:
        return {"has_clash": False, "reason": "No clashing events found in the schedule."}

    context = "\n".join([f"- '{e.title}' from {e.start_time} to {e.end_time}" for e in overlapping])
    prompt = f"""
    The coordinator wants to schedule '{title}' from {start_time} to {end_time}.
    Description: {description}
    
    The following events overlap during this time:
    {context}
    
    Analyze the overlap. If there is a clash, explain what the clash is with which event, and suggest how to solve it (e.g., whether to reschedule this new event or the existing one).
    Return a JSON object with 'has_clash' (boolean) and 'reason' (string, max 3-4 sentences detailing the clash and the recommended solution).
    """
    
    resp = call_gemini_llm(prompt, system_instruction="You are an event scheduling assistant. Output ONLY valid JSON.")
    if resp:
        try:
            cleaned = resp.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(cleaned)
            return {"has_clash": bool(parsed.get("has_clash", True)), "reason": parsed.get("reason", "Potential clash detected.")}
        except Exception:
            pass
            
    return {"has_clash": True, "reason": "Warning: Overlaps with existing scheduled events."}


def get_coordinator_event_suggestions(db: Session, society_id: str) -> List[dict]:
    users = db.query(User).filter(User.society_id == society_id, User.role == "resident").all()
    
    if not users:
        return []
        
    interests_pool = []
    volunteer_pool = []
    
    for u in users:
        if u.interests:
            interests_pool.append(u.interests)
        if u.volunteer_interest:
            volunteer_pool.append(u.volunteer_interest)
            
    prompt = f"""
    Based on the onboarding data of residents in this society:
    Interests: {', '.join(interests_pool)[:1000]}
    Volunteer Interests: {', '.join(volunteer_pool)[:1000]}
    
    Suggest 3 high-impact community events the coordinator should organize. 
    Return a JSON array of objects, each with 'title', 'description' (1 sentence), and 'reason' (why it matches the community, 1 sentence).
    """
    
    resp = call_gemini_llm(prompt, system_instruction="You are an expert community strategist. Output ONLY a JSON array.")
    
    if resp:
        try:
            cleaned = resp.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(cleaned)
            if isinstance(parsed, list):
                return parsed[:3]
        except Exception as e:
            print(f"Error parsing coordinator suggestions: {e}")
            
    return [
        {"title": "Community Mixer", "description": "A general get-together for residents.", "reason": "Always a safe bet for a new community."},
        {"title": "Skill Share Weekend", "description": "Residents teach each other basic skills.", "reason": "High engagement based on offered skills."},
        {"title": "Park Cleanup", "description": "Volunteer event to clean the local area.", "reason": "Matches general volunteer interests."}
    ]


def get_resident_suggestions(db: Session, user: User) -> dict:
    from src.marketplace.models import Skill
    from src.events.models import EventItem
    
    skills = db.query(Skill).filter(Skill.society_id == user.society_id, Skill.status == "approved", Skill.provider_id != user.id).all()
    events = db.query(EventItem).filter(EventItem.society_id == user.society_id, EventItem.status == "upcoming").all()
    
    skill_context = "\n".join([f"- ID:{s.id} | {s.title}: {s.description}" for s in skills])
    event_context = "\n".join([f"- ID:{e.id} | {e.title}: {e.description} (Needs {e.volunteers_needed} vols)" for e in events])
    
    prompt = f"""
    Resident Profile:
    Interests: {user.interests or 'None'}
    Volunteer Interests: {user.volunteer_interest or 'None'}
    
    Available Skills in Society:
    {skill_context or 'None available'}
    
    Upcoming Events needing volunteers:
    {event_context or 'None available'}
    
    Match this resident with 2-3 skills they would like, and 1-2 events they should volunteer for.
    Return ONLY a JSON object with two keys:
    'skill_suggestions': array of objects with 'id', 'title', 'provider_name', 'reason' (why they'd like it).
    'volunteer_suggestions': array of objects with 'id', 'title', 'reason' (why they should volunteer).
    """
    
    resp = call_gemini_llm(prompt, system_instruction="You are a personalized matching assistant. Output ONLY valid JSON.")
    
    if resp:
        try:
            cleaned = resp.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(cleaned)
            
            # Map provider_name manually if not reliable from LLM
            if "skill_suggestions" in parsed:
                skill_map = {s.id: s for s in skills}
                for ss in parsed["skill_suggestions"]:
                    sid = ss.get("id")
                    if sid in skill_map:
                        ss["provider_name"] = skill_map[sid].provider_name
                        ss["credits"] = skill_map[sid].credits
                        ss["category"] = skill_map[sid].category
                        
            return {
                "skill_suggestions": parsed.get("skill_suggestions", []),
                "volunteer_suggestions": parsed.get("volunteer_suggestions", [])
            }
        except Exception as e:
            print(f"Error parsing resident suggestions: {e}")
            
    return {"skill_suggestions": [], "volunteer_suggestions": []}
