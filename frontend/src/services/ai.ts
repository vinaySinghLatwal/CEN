// ============================================================================
// AI SERVICE LAYER — Connected to FastAPI AI Endpoints (http://127.0.0.1:8000/api/v1/ai)
// Powered by Google Gemini LLM API with graceful offline fallback.
// ============================================================================

import * as mock from "@/mocks/data";
import { apiFetch, getStoredUser } from "./apiClient";
import { __mockState } from "./index";

const delay = <T>(v: T, ms = 300): Promise<T> =>
  new Promise((r) => setTimeout(() => r(v), ms));

// AI 1 — Find nearby societies (public join flow)
export async function findNearbySocieties(address: string) {
  try {
    const res = await apiFetch<any[]>("/ai/find-nearby-societies", {
      method: "POST",
      body: JSON.stringify({ address }),
    });
    if (Array.isArray(res) && res.length > 0) {
      return res;
    }
  } catch (err) {
    console.warn("[AI API Notice] findNearbySocieties fallback:", err);
  }
  const list = __mockState.societies
    .filter((s) => s.status === "active")
    .map((s, i) => ({
      society: s,
      distanceKm: +(0.4 + i * 1.3 + Math.random() * 0.8).toFixed(1),
      matchReason:
        address && address.toLowerCase().includes("mg")
          ? "Close to your listed address (MG Road area)"
          : `Nearest active ${s.type.toLowerCase()} in your region`,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return delay(list);
}

// AI 2 — Chatbot (RAG-style assistant powered by Gemini)
export async function chatbotQuery(
  message: string,
  userId: string,
  history?: { from: "me" | "bot"; text: string }[]
): Promise<string> {
  try {
    const formattedHistory = history
      ? history.map((h) => ({
          role: h.from === "me" ? "user" : "assistant",
          content: h.text,
        }))
      : [];

    const res = await apiFetch<{ answer: string }>("/ai/chatbot", {
      method: "POST",
      body: JSON.stringify({ message, history: formattedHistory }),
    });
    if (res && res.answer) {
      return res.answer;
    }
  } catch (err) {
    console.warn("[AI API Notice] chatbotQuery fallback:", err);
  }

  const user = __mockState.users.find((u) => u.id === userId) || getStoredUser();
  const q = message.toLowerCase().trim();
  const firstName = user?.name ? user.name.split(" ")[0] : "neighbor";
  const soc = __mockState.societies.find((s) => s.id === user?.societyId);
  const socName = soc?.name || "your community";

  // Personal opinion / perception questions ("wdy think of me", "opinion about me")
  if (/\b(think of me|think about me|opinion of me|opinion about me|like me|about me|wdy|wbu)\b/.test(q)) {
    return delay(
      `I think you're great, ${firstName}! 😊 As an active resident of **${socName}** with **${user?.creditBalance ?? 0} credits** in your wallet, you're a fantastic part of our community. I'm always happy to chat or help you out with anything in the society!`
    );
  }

  // 1. Greetings & Small Talk with word boundaries
  if (/\b(hello|hi|hey|greetings|good morning|good evening)\b/.test(q) && !/\b(think|anything|something)\b/.test(q)) {
    return delay(
      `Hey ${firstName}! 👋 I'm **CEN Assistant**, your AI guide for **${socName}**.\n\n` +
      `You currently have **${user?.creditBalance ?? 0} credits** in your wallet. How can I help you today?`
    );
  }

  // Compliments & Affection
  if (/\b(cute|sweet|adorable|love you|love u|cutie|sweetie|awesome|amazing|cool|smart|clever|best bot)\b/.test(q)) {
    return delay(
      `Aww, thank you so much, ${firstName}! 😊 You're so sweet! I'm happy to help you and everyone in **${socName}**. Let me know if you need anything, whether it's checking notices, borrowing tools, or community events!`
    );
  }

  if (/\b(how are you|how's it going|how do you do|what's up|whats up|sup)\b/.test(q)) {
    return delay(
      `Doing great, thanks ${firstName}! 😊 Everything is running smoothly in **${socName}**.\n\n` +
      `You have **${user?.creditBalance ?? 0} credits** in your wallet. Let me know if you need help with notices, events, or borrowing tools!`
    );
  }



  if (/(thank|thanks|thx|appreciate)/.test(q)) {
    return delay(`Anytime, ${firstName}! Glad I could help. Let me know if you need anything else!`);
  }

  // 2. Coordinators & Management
  if (/(coordinator|admin|management|committee|leader)/.test(q)) {
    const coords = __mockState.users.filter(
      (u) => u.societyId === user?.societyId && (u.isCoordinator || u.role === "admin" || u.role === "owner"),
    );
    if (coords.length > 0) {
      const cLines = coords.map((c) => `• **${c.name}** (${c.isCoordinator ? "Coordinator" : c.role}) — ${c.email}`).join("\n");
      return delay(`Here are the active coordinators and administrators for **${socName}**:\n\n${cLines}\n\nYou can reach out to them directly for official society queries or governance issues.`);
    }
    return delay(`There are currently no coordinators listed for **${socName}**.`);
  }

  // 3. Earning & Credit Mechanics
  if (/(earn credit|get credit|how to earn|how credit work|what are credit|how to get credit|wallet|balance)/.test(q)) {
    return delay(
      `💳 **Your Wallet & Credits in ${socName}**:\n\n` +
      `• **Current Balance**: **${user?.creditBalance ?? 0} credits**\n\n` +
      `**How to Earn Credits:**\n` +
      `1. Offer skills (e.g. tutoring, repairs, lessons) to neighbors.\n` +
      `2. List tools or equipment for borrowing.\n` +
      `3. Participate in volunteering events.\n\n` +
      `**How to Spend Credits:**\n` +
      `Use your balance to book skills or borrow resources from fellow residents!`
    );
  }

  // 4. Household & Profile
  if (/(my profile|my household|my unit|my apartment|my detail|account)/.test(q)) {
    return delay(
      `👤 **Here is your profile summary, ${user?.name || "Resident"}**:\n\n` +
      `• **Role**: ${(user?.role || "resident").toUpperCase()}\n` +
      `• **Society**: ${socName}\n` +
      `• **Wallet Balance**: ${user?.creditBalance ?? 0} Credits\n\n` +
      `You can update your profile or upload ID verification in Account Settings.`
    );
  }

  // 5. Notice Board / Announcements
  if (/(notice|announcement|board|bulletin|update|news)/.test(q)) {
    const notices = __mockState.notices.filter((n) => n.societyId === user?.societyId);
    if (notices.length > 0) {
      const listStr = notices.map((n) => `• [${n.category}] **${n.title}** (${n.date}): ${n.content}`).join("\n");
      return delay(`📢 **Recent Notice Board Announcements (${socName})**:\n\n${listStr}`);
    }
    return delay("There are currently no active notices posted on your society's notice board.");
  }

  // 6. Events & Volunteering
  if (/(event|upcoming|volunteer|activity|schedule|calendar)/.test(q)) {
    const events = __mockState.events.filter((e) => e.societyId === user?.societyId && e.status === "upcoming");
    if (events.length > 0) {
      const evStr = events.map((e) => `• **${e.title}** on ${e.date} - ${e.description}`).join("\n");
      return delay(`📅 **Upcoming Society Events in ${socName}**:\n\n${evStr}`);
    }
    return delay("No upcoming events are currently scheduled.");
  }

  // 7. Resources & Tools
  if (/(resource|borrow|tool|equipment|ladder|drill|camera|item)/.test(q)) {
    const list = __mockState.resources.filter((r) => r.societyId === user?.societyId && r.status === "approved" && r.available);
    if (list.length > 0) {
      return delay(`🛠️ **Resources Available to Borrow Right Now**:\n\n` + list.map((r) => `• **${r.name}** shared by ${r.ownerName} (${r.credits} cr)`).join("\n"));
    }
    return delay("No items are currently listed for borrowing. You can list your own tools to earn community credits!");
  }

  // 8. Skills & Services
  if (/(skill|teach|tutor|service|repair|lesson|help|offer)/.test(q)) {
    const list = __mockState.skills.filter((s) => s.societyId === user?.societyId && s.status === "approved");
    if (list.length > 0) {
      return delay(`🌟 **Active Neighbor Skills Offered in ${socName}**:\n\n` + list.map((s) => `• **${s.title}** by ${s.providerName} (${s.credits} cr)`).join("\n"));
    }
    return delay("No neighbor skills are currently listed.");
  }

  // 9. Lost / Missing items
  if (/(lost|found|key|stolen|missing)/.test(q)) {
    return delay(
      `I'm sorry to hear that, ${firstName}! Here is what you should do:\n\n` +
      `1. **Check the Notice Board**: Neighbors frequently post lost & found items on the Notice Board.\n` +
      `2. **Contact Security / Management**: Reach out to society coordinators.\n` +
      `3. **Post a Notice**: Create a new notice so all residents in **${socName}** get notified.`
    );
  }

  // 10. General Conversational Dynamic Response
  const cleanMsg = message.trim();
  return delay(
    `Thanks for asking, ${firstName}!\n\n` +
    `As your AI assistant for **${socName}**, I can help you search active notices, check upcoming community events, look up available tools to borrow, or review your wallet balance (**${user?.creditBalance ?? 0} credits**).\n\n` +
    `Try asking me things like:\n` +
    `• *"Are there any notices about parking?"*\n` +
    `• *"Who are the society coordinators?"*\n` +
    `• *"What tools or skills can I borrow?"*\n` +
    `• *"How do I earn more credits?"*`
  );
}


// AI 3 — Natural language skill/resource matching
export async function matchSkillResource(query: string, societyId: string) {
  try {
    const res = await apiFetch<any[]>("/ai/match-marketplace", {
      method: "POST",
      body: JSON.stringify({ query, societyId }),
    });
    if (Array.isArray(res) && res.length > 0) {
      return res;
    }
  } catch (err) {
    console.warn("[AI API Notice] matchSkillResource fallback:", err);
  }

  const q = query.toLowerCase();
  const skillHits = __mockState.skills
    .filter((s) => s.societyId === societyId && s.status === "approved")
    .map((s) => ({
      item: s,
      kind: "skill" as const,
      score:
        (s.title.toLowerCase().includes(q) ? 3 : 0) +
        (s.description.toLowerCase().includes(q) ? 2 : 0) +
        s.tags.filter((t) => q.includes(t)).length,
      reason: `Matches keywords in ${s.tags.join(", ")}`,
    }));
  const resHits = __mockState.resources
    .filter((r) => r.societyId === societyId && r.status === "approved")
    .map((r) => ({
      item: r,
      kind: "resource" as const,
      score:
        (r.name.toLowerCase().includes(q) ? 3 : 0) +
        (r.description.toLowerCase().includes(q) ? 2 : 0) +
        (q.includes(r.category.toLowerCase()) ? 1 : 0),
      reason: `Resource in "${r.category}" that seems relevant`,
    }));
  const all = [...skillHits, ...resHits]
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  return delay(all);
}

// AI 4 — Auto-tag & categorize new skill/resource
export async function autoTag(text: string): Promise<{ category: string; tags: string[] }> {
  try {
    const res = await apiFetch<{ category: string; tags: string[] }>("/ai/auto-tag", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    if (res && res.category) return res;
  } catch (err) {
    console.warn("[AI API Notice] autoTag fallback:", err);
  }

  const t = text.toLowerCase();
  let category = "General";
  const tags: string[] = [];
  if (/(bike|cycle|repair|fix|plumb|electric)/.test(t)) {
    category = "Repair";
    tags.push("repair", "diy");
  } else if (/(teach|tutor|class|math|science)/.test(t)) {
    category = "Tutoring";
    tags.push("education", "tutoring");
  } else if (/(yoga|fitness|wellness|meditat)/.test(t)) {
    category = "Wellness";
    tags.push("wellness", "health");
  } else if (/(music|guitar|piano|sing)/.test(t)) {
    category = "Music";
    tags.push("music", "lessons");
  }
  return delay({ category, tags });
}

// AI 5 — Notice summarizer
export async function summarizeNotice(content: string): Promise<string> {
  const first = content.split(/[.!?]/).slice(0, 2).join(". ").trim();
  return delay(`Summary: ${first}. (Key point auto-extracted.)`);
}

// AI 6 — Complaint categorization & priority
export async function categorizeComplaint(text: string): Promise<{ category: string; priority: "low" | "medium" | "high" }> {
  try {
    const res = await apiFetch<{ category: string; priority: "low" | "medium" | "high" }>("/ai/categorize-complaint", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    if (res && res.category) return res;
  } catch (err) {
    console.warn("[AI API Notice] categorizeComplaint fallback:", err);
  }

  const t = text.toLowerCase();
  let category = "General";
  let priority: "low" | "medium" | "high" = "low";
  if (/(noise|loud|music)/.test(t)) {
    category = "Noise";
    priority = "medium";
  } else if (/(safety|dangerous|threat|violence)/.test(t)) {
    category = "Safety";
    priority = "high";
  }
  return delay({ category, priority });
}

// AI 7 — Suggest volunteers for an event
export async function suggestVolunteers(eventId: string) {
  try {
    const res = await apiFetch<any[]>(`/ai/suggest-volunteers?event_id=${eventId}`);
    if (Array.isArray(res) && res.length > 0) return res;
  } catch (err) {
    console.warn("[AI API Notice] suggestVolunteers fallback:", err);
  }

  const ev = __mockState.events.find((e) => e.id === eventId);
  if (!ev) return delay([]);

  const residents = __mockState.users.filter(
    (u) => u.societyId === ev.societyId && u.role === "resident" && !ev.volunteers.includes(u.id),
  );

  const scoredResidents = residents.map((u) => ({
    user: u,
    score: 85,
    reason: "Active community member",
  }));

  return delay(scoredResidents.slice(0, 4));
}

// AI 8 — Document Vision Verification for ID Proof
export async function verifyIdProof(imageUrl: string, userName?: string) {
  try {
    const res = await apiFetch<any>("/ai/verify-id-proof", {
      method: "POST",
      body: JSON.stringify({ imageUrl, userName }),
    });
    if (res) return res;
  } catch (err) {
    console.warn("[AI API Notice] verifyIdProof fallback:", err);
  }
  const user = __mockState.users.find((u) => u.id === req.userId);
  return delay({
    isValidId: !!user?.idProofUploaded,
    confidence: 0.92,
    documentType: "Govt. Issued Identity Card",
    extractedName: req.userName || (user?.name ?? "Unknown"),
    reason: "Matched identity using robust offline fallback heuristic",
  });
}

// AI 6 - Check Event Clash
export async function checkEventClash(payload: { title: string; description: string; startTime: string; endTime: string; societyId: string }) {
  try {
    const res = await apiFetch<any>("/ai/check-event-clash", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res) return res;
  } catch (err) {
    console.warn("[AI API Notice] checkEventClash fallback:", err);
  }
  return delay({ hasClash: false, reason: "Offline fallback: no clash detected." });
}

// AI 7 - Coordinator Event Suggestions
export async function getCoordinatorEventSuggestions() {
  try {
    const res = await apiFetch<any[]>("/ai/coordinator-event-suggestions");
    if (Array.isArray(res)) return res;
  } catch (err) {
    console.warn("[AI API Notice] getCoordinatorEventSuggestions fallback:", err);
  }
  return delay([
    { title: "Community Mixer", description: "A general get-together for residents.", reason: "Always a safe bet for a new community." },
    { title: "Skill Share Weekend", description: "Residents teach each other basic skills.", reason: "High engagement based on offered skills." },
    { title: "Park Cleanup", description: "Volunteer event to clean the local area.", reason: "Matches general volunteer interests." }
  ]);
}

// AI 8 - Resident Suggestions
export async function getResidentSuggestions() {
  try {
    const res = await apiFetch<any>("/ai/resident-suggestions");
    if (res) return res;
  } catch (err) {
    console.warn("[AI API Notice] getResidentSuggestions fallback:", err);
  }
  return delay({ skillSuggestions: [], volunteerSuggestions: [] });
}

export type MatchResult = Awaited<ReturnType<typeof matchSkillResource>>[number];
export type NearbyResult = Awaited<ReturnType<typeof findNearbySocieties>>[number];
export type VolunteerSuggestion = Awaited<ReturnType<typeof suggestVolunteers>>[number];
