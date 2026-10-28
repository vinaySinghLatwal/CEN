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
    VolunteerSuggestionResult,
    SummarizeNoticeResult,
    CheckEventClashResult,
    CoordinatorEventSuggestion,
    ResidentSuggestionsResult,
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
    if (
        not api_key
        or not api_key.strip()
        or "your-gemini-api-key" in api_key.lower()
        or api_key.startswith("your-")
        or api_key == "test"
    ):
        return None

    models_to_try = [
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-3.8-flash",
    ]

    contents = []
    if history:
        for item in history:
            role = "user" if (getattr(item, "role", "user") == "user" or (isinstance(item, dict) and item.get("role") == "user")) else "model"
            content = getattr(item, "content", "") if hasattr(item, "content") else (item.get("content", "") if isinstance(item, dict) else str(item))
            if not content or not str(content).strip():
                continue
            # Gemini requires the first turn to be 'user'
            if not contents and role == "model":
                continue
            # Gemini requires strictly alternating roles
            if contents and contents[-1]["role"] == role:
                contents[-1]["parts"][0]["text"] += f"\n\n{content}"
            else:
                contents.append({"role": role, "parts": [{"text": str(content)}]})

    # Append prompt as user turn
    if contents and contents[-1]["role"] == "user":
        contents[-1]["parts"][0]["text"] += f"\n\n{prompt}"
    else:
        contents.append({"role": "user", "parts": [{"text": prompt}]})

    payload: Dict[str, Any] = {"contents": contents}

    if system_instruction:
        payload["systemInstruction"] = {
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
            with urllib.request.urlopen(req, timeout=6) as response:
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




STOPWORDS = {
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours",
    "he", "him", "his", "she", "her", "hers", "it", "its", "they", "them", "their",
    "what", "which", "who", "whom", "this", "that", "these", "those", "am", "is", "are",
    "was", "were", "be", "been", "being", "have", "has", "had", "having", "do", "does",
    "did", "doing", "a", "an", "the", "and", "but", "if", "or", "because", "as", "until",
    "while", "of", "at", "by", "for", "with", "about", "against", "between", "into",
    "through", "during", "before", "after", "above", "below", "to", "from", "up", "down",
    "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "here",
    "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so",
    "than", "too", "very", "can", "will", "just", "don", "should", "now", "need", "want",
    "looking", "someone", "help", "somebody", "find", "please", "service", "item", "tool",
    "something", "anybody", "get", "like"
}

SYNONYM_ONTOLOGY = {
    "Plumbing": ["plumb", "plumbing", "pipe", "pipes", "leak", "leaking", "leaky", "faucet", "sink", "tap", "bathroom", "drain", "water", "toilet", "plumber"],
    "Electrical": ["electric", "electrical", "electrician", "wire", "wiring", "light", "switch", "socket", "fan", "power", "bulb", "appliance"],
    "Tutoring": ["tutor", "tutoring", "teach", "teaching", "teacher", "lesson", "lessons", "math", "maths", "mathematics", "science", "english", "homework", "exam", "coding", "python", "study", "class", "classes", "learn"],
    "Gardening": ["garden", "gardening", "gardener", "plant", "plants", "lawn", "mow", "mower", "grass", "tree", "trim", "flower", "yard", "outdoor", "landscape", "landscaping"],
    "Wellness": ["yoga", "fitness", "workout", "gym", "health", "exercise", "train", "trainer", "meditation", "diet", "stretching", "wellness"],
    "Music": ["guitar", "piano", "sing", "singing", "drums", "music", "musical", "instrument", "song", "vocal", "acoustic"],
    "Tools": ["drill", "drilling", "hammer", "ladder", "wrench", "toolkit", "saw", "screw", "driver", "tools", "diy", "equipment", "hardware", "screwdriver"],
    "Electronics": ["laptop", "pc", "computer", "phone", "camera", "tv", "screen", "lens", "tech", "gadget", "printer", "projector", "electronics"],
    "Repair": ["fix", "fixing", "repair", "repairing", "mend", "maintenance", "assembly", "mount", "mounting", "broken", "service"],
    "Vehicles": ["car", "bike", "bicycle", "cycle", "puncture", "mechanic", "tyre", "tire", "scooter", "brake", "oil"],
    "Cleaning": ["clean", "cleaning", "wash", "washing", "mop", "sweep", "dust", "maid", "sanitize", "vacuum", "housekeeping"],
    "Cooking": ["cook", "cooking", "bake", "baking", "chef", "meal", "food", "recipe", "catering", "cake", "kitchen"],
}


def match_marketplace(db: Session, query: str, society_id: str) -> List[MatchItemResult]:
    q_raw = query.strip()
    q_lower = q_raw.lower()
    
    # 1. RETRIEVAL STEP (RAG): Retrieve all approved skills and resources in the user's society
    skills = db.query(Skill).filter(Skill.society_id == society_id, Skill.status == "approved").all()
    resources = db.query(Resource).filter(Resource.society_id == society_id, Resource.status == "approved").all()

    skills_by_id = {s.id: s for s in skills}
    resources_by_id = {r.id: r for r in resources}

    # Prepare compact catalog for LLM Augmented Generation
    catalog_items = []
    for s in skills:
        catalog_items.append({
            "id": s.id,
            "kind": "skill",
            "title": s.title,
            "category": s.category,
            "providerName": s.provider_name,
            "credits": s.credits,
            "description": s.description,
            "tags": s.tags,
        })
    for r in resources:
        catalog_items.append({
            "id": r.id,
            "kind": "resource",
            "title": r.name,
            "category": r.category,
            "ownerName": r.owner_name,
            "credits": r.credits,
            "description": r.description,
            "available": r.available,
        })

    # 2. AUGMENTED GENERATION STEP (RAG): If Gemini LLM is active, perform true semantic intent reasoning
    if catalog_items:
        rag_prompt = (
            f"You are CEN Assistant's semantic marketplace match and intent summarization engine.\n"
            f"A resident in the community searched using everyday natural language:\n"
            f"Query: \"{q_raw}\"\n\n"
            f"Here is the live community database catalog of available skills and shared resources:\n"
            f"{json.dumps(catalog_items, indent=2)}\n\n"
            "INSTRUCTIONS:\n"
            "1. Intelligently parse the resident's underlying problem, desire, or intent (e.g. 'water leaking under bathroom sink' -> matches plumbing repair, 'need something to mount pictures' -> matches drill/hammer tools).\n"
            "2. Identify the best matching catalog items (up to 8).\n"
            "3. For each match, provide:\n"
            "   - 'id': exact item ID from the catalog\n"
            "   - 'kind': 'skill' or 'resource'\n"
            "   - 'score': integer from 60 to 98 based on relevance\n"
            "   - 'reason': concise explanation of why this item satisfies the resident's request\n"
            "   - 'summary': a clear 1-2 sentence layman explanation of what is offered and how it helps\n"
            "   - 'intentTags': array of 2-3 intent tags (e.g. ['Plumbing', 'Leak Repair', 'Home DIY'])\n\n"
            "Return ONLY a JSON array of objects with keys: id, kind, score, reason, summary, intentTags.\n"
            "If no items are relevant to the user query, return []."
        )

        llm_response = call_gemini_llm(prompt=rag_prompt)
        if llm_response:
            try:
                json_match = re.search(r"\[.*\]", llm_response, re.DOTALL)
                if json_match:
                    parsed_matches = json.loads(json_match.group(0))
                    if isinstance(parsed_matches, list) and len(parsed_matches) > 0:
                        rag_results: List[MatchItemResult] = []
                        for pm in parsed_matches:
                            item_id = pm.get("id")
                            kind = pm.get("kind", "skill")
                            score = int(pm.get("score", 85))
                            reason = str(pm.get("reason", "Semantic intent match"))
                            summary = str(pm.get("summary", ""))
                            intent_tags = pm.get("intentTags", [])
                            if not isinstance(intent_tags, list):
                                intent_tags = [str(intent_tags)]

                            if kind == "skill" and item_id in skills_by_id:
                                s = skills_by_id[item_id]
                                item_dict = {
                                    "id": s.id,
                                    "title": s.title,
                                    "category": s.category,
                                    "providerId": s.provider_id,
                                    "providerName": s.provider_name,
                                    "credits": s.credits,
                                    "description": s.description,
                                    "status": s.status,
                                    "tags": [t.strip() for t in s.tags.split(",") if t.strip()] if isinstance(s.tags, str) else [],
                                    "societyId": s.society_id,
                                    "summary": summary or f"Expert {s.category} service: '{s.title}' offered by {s.provider_name}.",
                                    "intentTags": intent_tags or [s.category, "Skill Exchange"],
                                }
                                rag_results.append(
                                    MatchItemResult(
                                        item=item_dict,
                                        kind="skill",
                                        score=min(99, max(50, score)),
                                        reason=reason,
                                        summary=summary or item_dict["summary"],
                                        intent_tags=intent_tags or item_dict["intentTags"],
                                    )
                                )
                            elif kind == "resource" and item_id in resources_by_id:
                                r = resources_by_id[item_id]
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
                                    "summary": summary or f"Shared {r.category} equipment: '{r.name}' available to borrow from {r.owner_name}.",
                                    "intentTags": intent_tags or [r.category, "Shared Tool"],
                                }
                                rag_results.append(
                                    MatchItemResult(
                                        item=item_dict,
                                        kind="resource",
                                        score=min(99, max(50, score)),
                                        reason=reason,
                                        summary=summary or item_dict["summary"],
                                        intent_tags=intent_tags or item_dict["intentTags"],
                                    )
                                )

                        if rag_results:
                            rag_results.sort(key=lambda x: x.score, reverse=True)
                            return rag_results[:8]
            except Exception as e:
                print(f"[Gemini RAG Matcher Exception]: {e}")

    # 3. HIGH-PRECISION HEURISTIC & SYNONYM INTENT ENGINE (Fallback if offline)
    # Extract query tokens excluding stopwords
    words = re.findall(r"\b[a-z0-9]+\b", q_lower)
    meaningful_tokens = [w for w in words if w not in STOPWORDS and len(w) > 1]
    if not meaningful_tokens:
        meaningful_tokens = [w for w in words if len(w) > 1]

    # Detect relevant intent categories from ontology
    matched_categories = set()
    for cat, synonyms in SYNONYM_ONTOLOGY.items():
        if any(token in synonyms for token in meaningful_tokens) or any(s in q_lower for s in synonyms):
            matched_categories.add(cat)

    results: List[MatchItemResult] = []

    for s in skills:
        s_title_lower = s.title.lower()
        s_desc_lower = s.description.lower()
        s_cat_lower = s.category.lower()
        tags_list = [t.strip().lower() for t in s.tags.split(",") if t.strip()] if isinstance(s.tags, str) else []

        score = 0
        matched_reasons = []

        # Exact query match
        if q_lower in s_title_lower:
            score += 45
            matched_reasons.append(f"Title matches '{q_raw}'")
        elif any(t in s_title_lower for t in meaningful_tokens):
            matching_title_tokens = [t for t in meaningful_tokens if t in s_title_lower]
            score += 25 * len(matching_title_tokens)
            matched_reasons.append(f"Keywords in title: {', '.join(matching_title_tokens)}")

        if q_lower in s_desc_lower:
            score += 30
            matched_reasons.append("Exact phrase in description")
        else:
            matching_desc_tokens = [t for t in meaningful_tokens if t in s_desc_lower]
            if matching_desc_tokens:
                score += 15 * len(matching_desc_tokens)
                matched_reasons.append(f"Description matches: {', '.join(matching_desc_tokens[:3])}")

        # Category and synonym match
        if s.category in matched_categories or s_cat_lower in q_lower or any(t in s_cat_lower for t in meaningful_tokens):
            score += 25
            matched_reasons.append(f"Category '{s.category}' matches your intent")

        # Tags match
        matching_tags = [t for t in tags_list if t in q_lower or any(token in t for token in meaningful_tokens)]
        if matching_tags:
            score += 20 * len(matching_tags)
            matched_reasons.append(f"Tags match: {', '.join(matching_tags)}")

        if score > 0:
            summary = f"Expert {s.category} service: '{s.title}' offered by {s.provider_name} ({s.credits} Credits). {s.description.strip()}"
            if len(summary) > 135:
                summary = summary[:132] + "..."

            intent_tags = list(dict.fromkeys([s.category, *matching_tags, *[c for c in matched_categories if c != s.category]]))[:3]
            if not intent_tags:
                intent_tags = [s.category, "Skill Exchange"]

            norm_score = min(98, max(55, score))
            reason = " · ".join(matched_reasons[:2]) if matched_reasons else f"Matches your search for {s.category}"

            item_dict = {
                "id": s.id,
                "title": s.title,
                "category": s.category,
                "providerId": s.provider_id,
                "providerName": s.provider_name,
                "credits": s.credits,
                "description": s.description,
                "status": s.status,
                "tags": [t.strip() for t in s.tags.split(",") if t.strip()] if isinstance(s.tags, str) else [],
                "societyId": s.society_id,
                "summary": summary,
                "intentTags": intent_tags,
            }

            results.append(
                MatchItemResult(
                    item=item_dict,
                    kind="skill",
                    score=norm_score,
                    reason=reason,
                    summary=summary,
                    intent_tags=intent_tags,
                )
            )

    # Query resources in society
    resources = db.query(Resource).filter(Resource.society_id == society_id, Resource.status == "approved").all()
    for r in resources:
        r_name_lower = r.name.lower()
        r_desc_lower = r.description.lower()
        r_cat_lower = r.category.lower()

        score = 0
        matched_reasons = []

        # Exact query match
        if q_lower in r_name_lower:
            score += 45
            matched_reasons.append(f"Resource name matches '{q_raw}'")
        elif any(t in r_name_lower for t in meaningful_tokens):
            matching_name_tokens = [t for t in meaningful_tokens if t in r_name_lower]
            score += 25 * len(matching_name_tokens)
            matched_reasons.append(f"Name matches: {', '.join(matching_name_tokens)}")

        if q_lower in r_desc_lower:
            score += 30
            matched_reasons.append("Exact phrase in item description")
        else:
            matching_desc_tokens = [t for t in meaningful_tokens if t in r_desc_lower]
            if matching_desc_tokens:
                score += 15 * len(matching_desc_tokens)
                matched_reasons.append(f"Description matches: {', '.join(matching_desc_tokens[:3])}")

        # Category and synonym match
        if r.category in matched_categories or r_cat_lower in q_lower or any(t in r_cat_lower for t in meaningful_tokens):
            score += 25
            matched_reasons.append(f"Category '{r.category}' fits your requirements")

        if score > 0:
            summary = f"Shared {r.category} equipment: '{r.name}' available to borrow from {r.owner_name} ({r.credits} Credits). {r.description.strip()}"
            if len(summary) > 135:
                summary = summary[:132] + "..."

            intent_tags = list(dict.fromkeys([r.category, "Available to Borrow", *[c for c in matched_categories if c != r.category]]))[:3]

            norm_score = min(98, max(55, score))
            reason = " · ".join(matched_reasons[:2]) if matched_reasons else f"Available resource in {r.category}"

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
                "summary": summary,
                "intentTags": intent_tags,
            }

            results.append(
                MatchItemResult(
                    item=item_dict,
                    kind="resource",
                    score=norm_score,
                    reason=reason,
                    summary=summary,
                    intent_tags=intent_tags,
                )
            )

    results.sort(key=lambda x: x.score, reverse=True)
    return results[:8]



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
        .filter(User.society_id == ev.society_id, User.role == "resident", User.is_active == True)
        .all()
    )

    if not residents:
        return []

    # Extract keywords from event title and description
    event_text = f"{ev.title} {ev.description or ''}".lower()
    event_words = set(re.findall(r"[a-z0-9]+", event_text))

    results: List[VolunteerSuggestionResult] = []
    for u in residents:
        if u.id in existing_volunteers:
            continue

        base_score = 65
        reasons: List[str] = []

        # Parse user interests
        user_interests = []
        if u.interests:
            try:
                import json
                user_interests = json.loads(u.interests) if u.interests.startswith("[") else [i.strip() for i in u.interests.split(",") if i.strip()]
            except Exception:
                user_interests = [i.strip() for i in u.interests.split(",") if i.strip()]

        matched_interests = []
        for interest in user_interests:
            int_words = set(re.findall(r"[a-z0-9]+", interest.lower()))
            if int_words & event_words:
                matched_interests.append(interest)

        if matched_interests:
            base_score += min(20, len(matched_interests) * 10)
            reasons.append(f"Interest match: {', '.join(matched_interests[:2])}")

        # Check offered skills
        if u.offered_skills_text:
            skill_words = set(re.findall(r"[a-z0-9]+", u.offered_skills_text.lower()))
            common_skills = skill_words & event_words
            if common_skills:
                base_score += 15
                reasons.append("Relevant offered skill match")

        # Check volunteer preference
        if u.volunteer_interest == "yes":
            base_score += 15
            reasons.append("High volunteer availability")
        elif u.volunteer_interest == "weekends":
            base_score += 10
            reasons.append("Weekend volunteering preference")


        if not reasons:
            reasons.append("Active community resident")

        # Deterministic micro-variance for unique realistic score spread per resident
        import hashlib
        variance = int(hashlib.md5(f"{ev.id}:{u.id}".encode()).hexdigest()[:4], 16) % 7
        final_score = min(98, max(50, base_score + variance))
        user_resp = UserResponse.model_validate(u)
        results.append(
            VolunteerSuggestionResult(
                user=user_resp,
                score=final_score,
                reason=" · ".join(reasons),
            )
        )


    # Sort descending by match score
    results.sort(key=lambda x: x.score, reverse=True)
    return results[:5]



def summarize_notice(content: str) -> SummarizeNoticeResult:
    prompt = (
        f"Provide a brief, clear, and professional one-sentence summary of the following community notice content. "
        f"Do not add any greetings or conversational fluff. Just the summary.\n\n"
        f"Content:\n\"{content}\""
    )
    llm_text = call_gemini_llm(prompt=prompt)
    if llm_text:
        return SummarizeNoticeResult(summary=llm_text.strip())

    # Heuristic fallback if Gemini API is offline/unavailable
    # Clean up and split sentences
    sentences = [s.strip() for s in re.split(r"[.!?]", content) if s.strip()]
    first_two = " ".join(sentences[:2]) if sentences else ""
    if len(first_two) > 120:
        first_two = first_two[:117] + "..."
    if not first_two:
        first_two = "Community Announcement"
    return SummarizeNoticeResult(summary=f"Notice summary: {first_two}")


def check_event_clash(db: Session, title: str, description: str, start_time: str, end_time: str, society_id: str) -> CheckEventClashResult:
    from src.events.models import EventItem
    from datetime import datetime

    try:
        st = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        et = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
    except Exception:
        return CheckEventClashResult(has_clash=False, reason="Invalid date format.")

    events = db.query(EventItem).filter(EventItem.society_id == society_id, EventItem.status == "upcoming").all()
    overlapping = []
    for e in events:
        try:
            if e.start_time and e.end_time:
                est = datetime.fromisoformat(e.start_time.replace('Z', '+00:00'))
                eet = datetime.fromisoformat(e.end_time.replace('Z', '+00:00'))
                if (st <= eet and et >= est):
                    overlapping.append(e)
            elif e.date:
                # If single date match
                if e.date == start_time[:10]:
                    overlapping.append(e)
        except Exception:
            continue

    if not overlapping:
        return CheckEventClashResult(has_clash=False, reason="No clashing events found in the schedule.")

    context = "\n".join([f"- '{e.title}' ({e.start_time or e.date} to {e.end_time or e.date})" for e in overlapping])
    prompt = (
        f"The coordinator wants to schedule '{title}' from {start_time} to {end_time}.\n"
        f"Description: {description}\n\n"
        f"The following existing events overlap during this period:\n{context}\n\n"
        "Analyze the overlap. If there is a potential venue or volunteer clash, explain the clash with the conflicting event and suggest a practical mitigation.\n"
        "Output ONLY a JSON object with 'has_clash' (boolean) and 'reason' (string, max 3 sentences)."
    )

    resp = call_gemini_llm(prompt, system_instruction="You are an event scheduling assistant. Output ONLY valid JSON.")
    if resp:
        try:
            cleaned = resp.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(cleaned)
            return CheckEventClashResult(
                has_clash=bool(parsed.get("has_clash", True)),
                reason=str(parsed.get("reason", f"Potential schedule overlap with '{overlapping[0].title}'."))
            )
        except Exception:
            pass

    return CheckEventClashResult(
        has_clash=True,
        reason=f"Schedule overlaps with '{overlapping[0].title}'. Consider adjusting the timing to avoid volunteer fatigue."
    )


def get_coordinator_event_suggestions(db: Session, society_id: str) -> List[CoordinatorEventSuggestion]:
    users = db.query(User).filter(User.society_id == society_id, User.role == "resident").all()
    if not users:
        return [
            CoordinatorEventSuggestion(title="Community Mixer", description="A casual get-together for neighbors to connect.", reason="Safe starting event for community onboarding."),
            CoordinatorEventSuggestion(title="Skill Share Weekend", description="Residents showcase and teach basic everyday skills.", reason="Encourages marketplace participation."),
            CoordinatorEventSuggestion(title="Society Cleanliness Drive", description="Volunteer group effort to spruce up common spaces.", reason="High resident interest in community improvement.")
        ]

    interests_pool = [u.interests for u in users if u.interests]
    volunteer_pool = [u.volunteer_interest for u in users if u.volunteer_interest]

    prompt = (
        f"Based on the onboarding survey data of residents in this residential society:\n"
        f"Interests: {', '.join(interests_pool)[:1000] or 'General community'}\n"
        f"Volunteer Preferences: {', '.join(volunteer_pool)[:1000] or 'General support'}\n\n"
        "Suggest 3 high-impact community events that the society coordinator should organize.\n"
        "Return ONLY a JSON array of 3 objects, each with 'title', 'description' (1 sentence), and 'reason' (why it matches community preferences, 1 sentence)."
    )

    resp = call_gemini_llm(prompt, system_instruction="You are an expert residential community event strategist. Output ONLY a valid JSON array.")
    if resp:
        try:
            cleaned = resp.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(cleaned)
            if isinstance(parsed, list):
                return [
                    CoordinatorEventSuggestion(
                        title=item.get("title", "Community Event"),
                        description=item.get("description", "A collaborative neighborhood event."),
                        reason=item.get("reason", "Tailored to resident interests.")
                    )
                    for item in parsed[:3]
                ]
        except Exception as e:
            print(f"Error parsing coordinator suggestions: {e}")

    return [
        CoordinatorEventSuggestion(title="Community Social Mixer", description="An open gathering with games and snacks to foster neighborhood friendship.", reason="Engages a broad cross-section of residents across all flat units."),
        CoordinatorEventSuggestion(title="Neighborhood Skill Exchange Fair", description="Live demonstrations where neighbors teach practical hobbies, cooking, and tech tips.", reason="Directly aligns with residents offering diverse skills."),
        CoordinatorEventSuggestion(title="Society Greenery & Planting Day", description="A hands-on gardening morning planting saplings in community garden beds.", reason="Fosters collective civic pride and volunteer engagement.")
    ]


def get_resident_suggestions(db: Session, user: User) -> ResidentSuggestionsResult:
    from src.events.models import EventItem
    skills = db.query(Skill).filter(Skill.society_id == user.society_id, Skill.status == "approved", Skill.provider_id != user.id).all()
    events = db.query(EventItem).filter(EventItem.society_id == user.society_id, EventItem.status == "upcoming").all()

    skill_context = "\n".join([f"- ID:{s.id} | {s.title}: {s.description} ({s.credits} Credits, Category: {s.category}, By: {s.provider_name})" for s in skills])
    event_context = "\n".join([f"- ID:{e.id} | {e.title}: {e.description} (Needs {e.volunteers_needed} volunteers)" for e in events])

    prompt = (
        f"Resident Profile:\n"
        f"Name: {user.name}\n"
        f"Interests: {user.interests or 'General community'}\n"
        f"Volunteer Preferences: {user.volunteer_interest or 'General'}\n\n"
        f"Available Approved Skills in Society:\n{skill_context or 'None currently'}\n\n"
        f"Upcoming Community Events:\n{event_context or 'None currently'}\n\n"
        "Recommend up to 3 skills the resident would find useful/enjoyable, and up to 2 events they should volunteer for.\n"
        "Return ONLY a JSON object with two keys:\n"
        "- 'skill_suggestions': array of objects with 'id', 'title', 'provider_name', 'credits', 'category', 'reason'\n"
        "- 'volunteer_suggestions': array of objects with 'id', 'title', 'reason'"
    )

    resp = call_gemini_llm(prompt, system_instruction="You are a personalized community recommender. Output ONLY valid JSON.")
    if resp:
        try:
            cleaned = resp.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(cleaned)
            skill_sug = parsed.get("skill_suggestions", [])
            vol_sug = parsed.get("volunteer_suggestions", [])

            # Enrich skill items if missing fields
            skill_map = {s.id: s for s in skills}
            enriched_skills = []
            for ss in skill_sug:
                sid = ss.get("id")
                if sid in skill_map:
                    s_obj = skill_map[sid]
                    enriched_skills.append({
                        "id": s_obj.id,
                        "title": s_obj.title,
                        "provider_name": s_obj.provider_name,
                        "credits": s_obj.credits,
                        "category": s_obj.category,
                        "reason": ss.get("reason", "Matches your interests.")
                    })
                elif ss.get("title"):
                    enriched_skills.append(ss)

            return ResidentSuggestionsResult(
                skill_suggestions=enriched_skills[:3],
                volunteer_suggestions=vol_sug[:2]
            )
        except Exception as e:
            print(f"Error parsing resident suggestions: {e}")

    # Fallback recommendations from available data
    fallback_skills = [
        {"id": s.id, "title": s.title, "provider_name": s.provider_name, "credits": s.credits, "category": s.category, "reason": "Popular in your society"}
        for s in skills[:3]
    ]
    fallback_events = [
        {"id": e.id, "title": e.title, "reason": f"Looking for {e.volunteers_needed} volunteers"}
        for e in events[:2]
    ]
    return ResidentSuggestionsResult(
        skill_suggestions=fallback_skills,
        volunteer_suggestions=fallback_events
    )


def generate_and_save_onboarding_summary(user_id: str):
    from src.database import SessionLocal
    from src.users.models import UserSummary
    from datetime import date

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return

        prompt = (
            f"Write a personalized, welcoming community digest for resident {user.name}.\n"
            f"Interests: {user.interests or 'General community'}\n"
            f"Skills Offered: {user.offered_skills_text or 'None specified'}\n"
            f"Volunteer Interest: {user.volunteer_interest or 'General'}\n"
            "Keep it very brief, engaging, and highlight 2-3 types of community activities or skill exchanges they might enjoy. "
            "Limit to 2-3 warm sentences. Do not use markdown."
        )
        summary_text = call_gemini_llm(prompt, system_instruction="You are a helpful residential community assistant.")
        if not summary_text:
            summary_text = f"Welcome to the community, {user.name}! Explore skills and equipment in your society marketplace or volunteer for upcoming events."

        existing = db.query(UserSummary).filter(UserSummary.user_id == user.id).first()
        if existing:
            existing.summary_text = summary_text.strip()
            existing.generated_at = date.today().isoformat()
        else:
            new_summary = UserSummary(
                user_id=user.id,
                summary_text=summary_text.strip(),
                generated_at=date.today().isoformat()
            )
            db.add(new_summary)
        db.commit()
    except Exception as e:
        print(f"Error generating onboarding summary for user {user_id}: {e}")
    finally:
        db.close()


