// ============================================================================
// SERVICE LAYER — Professional Integration Layer connected to FastAPI Backend
// (http://127.0.0.1:8000/api/v1). Features graceful fallback if backend is offline.
// ============================================================================

import * as mock from "@/mocks/data";
import { apiFetch, clearStoredAuth, getStoredUser, setStoredAuth } from "./apiClient";

const delay = <T>(v: T, ms = 200): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(v), ms));

// In-memory mutable state fallback for offline dev mode
const state = {
  users: [...mock.users],
  societies: [...mock.societies],
  households: [...mock.households],
  applications: [...mock.societyApplications],
  joinRequests: [...mock.joinRequests],
  skills: [...mock.skills],
  resources: [...mock.resources],
  transactions: [...mock.transactions],
  events: [...mock.events],
  volunteerRequests: [...mock.volunteerRequests],
  complaints: [...mock.complaints],
  notices: [...mock.notices],
  chat: [...mock.chatMessages],
};

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

// ---------------- Auth ----------------
export const authService = {
  login: async (email: string, password: string = "password123") => {
    try {
      const res = await apiFetch<any>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (res && res.user) {
        const token = res.accessToken || res.access_token;
        setStoredAuth(token, res.user);
        return res.user;
      }
    } catch (err) {
      console.warn("[API Notice] login fallback to local state:", err);
    }
    const user = state.users.find((u) => u.email === email);
    if (user) setStoredAuth("mock-token-123", user);
    return delay(user ?? null);
  },
  signup: async (name: string, email: string, password: string = "password123") => {
    try {
      const res = await apiFetch<any>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      if (res && res.user) {
        const token = res.accessToken || res.access_token;
        setStoredAuth(token, res.user);
        return res.user;
      }
    } catch (err: any) {
      if (err.message) throw err;
    }
    const u: mock.User = {
      id: uid("u"),
      name,
      email,
      role: "resident",
      creditBalance: 10,
      joinedDate: new Date().toISOString().slice(0, 10),
      idProofUploaded: false,
      isCoordinator: false,
      hasCompletedSurvey: false,
    };
    state.users.push(u);
    setStoredAuth("mock-token-123", u);
    return delay(u);
  },
  logout: async () => {
    clearStoredAuth();
    return delay(true);
  },
  getUserById: async (id: string) => {
    try {
      const res = await apiFetch<any>("/users/me");
      if (res) return res;
    } catch (err) {
      try {
        const res2 = await apiFetch<any>(`/users/${id}`);
        if (res2) return res2;
      } catch (e) {
        console.warn("[API Notice] getUserById fallback:", e);
      }
    }
    return delay(state.users.find((u) => u.id === id) ?? null);
  },
};

// ---------------- Societies ----------------
export const societyService = {
  list: async () => {
    try {
      const res = await apiFetch<any[]>("/societies");
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] list societies fallback:", err);
    }
    return delay(state.societies);
  },
  getById: async (id: string) => {
    try {
      const res = await apiFetch<any>(`/societies/${id}`);
      if (res) return res;
    } catch (err) {
      console.warn("[API Notice] getById society fallback:", err);
    }
    return delay(state.societies.find((s) => s.id === id) ?? null);
  },
  submitApplication: async (a: any) => {
    try {
      const res = await apiFetch<any>("/societies/applications", {
        method: "POST",
        body: JSON.stringify({
          societyName: a.societyName,
          type: a.type || "Residential Apartment",
          address: a.address,
          applicantName: a.applicantName || "Applicant",
          applicantContact: a.applicantContact,
          reason: a.reason || "Request to create society network",
          residentCount: Number(a.residentCount) || Number(a.estimatedCap) || 100,
          initialCredits: Number(a.initialCredits) || 10,
        }),
      });
      if (res) return res;
    } catch (err: any) {
      if (err.message) throw err;
    }
    const app: mock.SocietyApplication = {
      ...a,
      id: uid("app"),
      status: "pending",
      submittedAt: new Date().toISOString().slice(0, 10),
    };
    state.applications.push(app);
    return delay(app);
  },
  listApplications: async () => {
    try {
      const res = await apiFetch<any[]>("/societies/applications");
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] listApplications fallback:", err);
    }
    return delay(state.applications);
  },
  approveApplication: async (id: string, capacity: number, initialCredits: number = 10) => {
    try {
      const res = await apiFetch<any>(`/societies/applications/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ capacity, initialCredits }),
      });
      if (res) return true;
    } catch (err) {
      console.warn("[API Notice] approveApplication fallback:", err);
    }
    const a = state.applications.find((x) => x.id === id);
    if (a) {
      a.status = "approved";
      const socId = uid("soc");
      const applicantUser = state.users.find((u) => u.email.toLowerCase() === a.applicantContact.toLowerCase());
      const adminId = applicantUser ? applicantUser.id : uid("u");
      if (applicantUser) {
        applicantUser.role = "admin";
        applicantUser.societyId = socId;
      }
      const newSoc: mock.Society = {
        id: socId,
        name: a.societyName,
        type: a.type,
        address: a.address,
        latitude: 12.97,
        longitude: 77.59,
        adminId: adminId,
        capacity: capacity,
        initialCredits: initialCredits,
        householdRangeStart: 1,
        householdRangeEnd: capacity,
        coordinatorCount: 0,
        status: "active",
        performanceScore: 100,
        key: a.societyName.toUpperCase().slice(0, 4) + "-" + uid("k").toUpperCase().slice(0, 4),
      };
      state.societies.push(newSoc);
    }
    return delay(true);
  },
  updateSocietyConfig: async (id: string, config: { capacity?: number; initialCredits?: number }) => {
    try {
      const res = await apiFetch<any>(`/societies/${id}/config`, {
        method: "PATCH",
        body: JSON.stringify(config),
      });
      if (res) return res;
    } catch (err) {
      console.warn("[API Notice] updateSocietyConfig fallback:", err);
    }
    const s = state.societies.find((x) => x.id === id);
    if (s) {
      if (config.capacity !== undefined) s.capacity = config.capacity;
      if (config.initialCredits !== undefined) s.initialCredits = config.initialCredits;
    }
    return delay(s ?? null);
  },
  rejectApplication: async (id: string) => {
    try {
      await apiFetch<any>(`/societies/applications/${id}/reject`, { method: "POST" });
      return true;
    } catch (err) {
      console.warn("[API Notice] rejectApplication fallback:", err);
    }
    const a = state.applications.find((x) => x.id === id);
    if (a) a.status = "rejected";
    return delay(true);
  },
  suspend: async (id: string) => {
    try {
      await apiFetch<any>(`/societies/${id}/suspend`, { method: "POST" });
      return true;
    } catch (err) {
      console.warn("[API Notice] suspend fallback:", err);
    }
    const s = state.societies.find((x) => x.id === id);
    if (s) s.status = "suspended";
    return delay(true);
  },
  getApplicationByEmail: async (email: string) => {
    try {
      const res = await apiFetch<any>("/societies/applications/me");
      if (res) return res;
    } catch (err: any) {
      if (err.message && !err.message.includes("404") && !err.message.includes("No active")) {
        console.warn("[API Notice] getApplicationByEmail fallback:", err);
      }
    }
    return delay(state.applications.find((a) => a.applicantContact.toLowerCase() === email.toLowerCase()) ?? null);
  },
  deleteApplication: async (id: string) => {
    try {
      await apiFetch<any>(`/societies/applications/${id}`, { method: "DELETE" });
      return true;
    } catch (err) {
      console.warn("[API Notice] deleteApplication fallback:", err);
    }
    const idx = state.applications.findIndex((x) => x.id === id);
    if (idx !== -1) state.applications.splice(idx, 1);
    return delay(true);
  },
};

// ---------------- Households ----------------
export const householdService = {
  listBySociety: async (societyId: string) => {
    try {
      const res = await apiFetch<any[]>(`/households?society_id=${societyId}`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] listBySociety households fallback:", err);
    }
    return delay(state.households.filter((h) => h.societyId === societyId));
  },
  register: async (societyId: string, unitNumber: string) => {
    try {
      const res = await apiFetch<any>("/households", {
        method: "POST",
        body: JSON.stringify({ societyId, unitNumber }),
      });
      if (res) return res;
    } catch (err: any) {
      if (err.message) throw err;
    }
    const trimmed = unitNumber.trim();
    const h: mock.Household = { id: uid("h"), societyId, unitNumber: trimmed, claimed: false };
    state.households.push(h);
    return delay(h);
  },
  claim: async (householdId: string, userId: string) => {
    const h = state.households.find((x) => x.id === householdId);
    if (h) {
      h.claimed = true;
      h.claimedByUserId = userId;
    }
    return delay(true);
  },
  bulkGenerate: async (societyId: string, blocks: string[], start: number, end: number, format: string) => {
    try {
      const res = await apiFetch<any[]>("/households/bulk", {
        method: "POST",
        body: JSON.stringify({
          societyId,
          blocks,
          startUnit: start,
          endUnit: end,
          formatPattern: format,
        }),
      });
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] bulkGenerate households fallback:", err);
    }
    const list: mock.Household[] = [];
    const blockList = blocks.length > 0 ? blocks : [""];
    blockList.forEach((b) => {
      for (let i = start; i <= end; i++) {
        let name = format.replace("{Block}", b).replace("{Unit}", String(i));
        list.push({ id: uid("h"), societyId, unitNumber: name, claimed: false });
      }
    });
    state.households.push(...list);
    return delay(list);
  },
  updateUnitNumber: async (id: string, unitNumber: string) => {
    try {
      const res = await apiFetch<any>(`/households/${id}?unit_number=${encodeURIComponent(unitNumber)}`, {
        method: "PUT",
      });
      if (res) return res;
    } catch (err) {
      console.warn("[API Notice] updateUnitNumber fallback:", err);
    }
    const h = state.households.find((x) => x.id === id);
    if (h) h.unitNumber = unitNumber;
    return delay(h ?? null);
  },
  deleteHousehold: async (id: string) => {
    try {
      await apiFetch<any>(`/households/${id}`, { method: "DELETE" });
      return true;
    } catch (err) {
      console.warn("[API Notice] deleteHousehold fallback:", err);
    }
    const idx = state.households.findIndex((x) => x.id === id);
    if (idx !== -1) state.households.splice(idx, 1);
    return delay(true);
  },
  deleteAll: async (societyId: string) => {
    try {
      await apiFetch<any>(`/households/society/${societyId}`, { method: "DELETE" });
      return true;
    } catch (err) {
      console.warn("[API Notice] deleteAll households fallback:", err);
    }
    state.households = state.households.filter((h) => h.societyId !== societyId);
    return delay(true);
  },
};

// ---------------- Join Requests ----------------
export const joinRequestService = {
  submit: async (req: any) => {
    try {
      const res = await apiFetch<any>("/societies/join-requests", {
        method: "POST",
        body: JSON.stringify({
          societyId: req.societyId,
          householdId: req.householdId,
          unitNumber: req.unitNumber,
          idProofUrl: req.idProofUrl || "mock://id-proof.pdf",
        }),
      });
      if (res) return res;
    } catch (err: any) {
      if (err.message) throw err;
    }
    const j: mock.JoinRequest = {
      ...req,
      id: uid("jr"),
      status: "pending",
      submittedAt: new Date().toISOString().slice(0, 10),
    };
    state.joinRequests.push(j);
    return delay(j);
  },
  listBySociety: async (societyId: string) => {
    try {
      const res = await apiFetch<any[]>(`/societies/${societyId}/join-requests`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] listBySociety joinRequests fallback:", err);
    }
    return delay(state.joinRequests.filter((r) => r.societyId === societyId));
  },
  approve: async (id: string) => {
    try {
      await apiFetch<any>(`/societies/join-requests/${id}/approve`, { method: "POST" });
      return true;
    } catch (err) {
      console.warn("[API Notice] approve joinRequest fallback:", err);
    }
    const r = state.joinRequests.find((x) => x.id === id);
    if (r) {
      r.status = "approved";
      const u = state.users.find((x) => x.id === r.userId);
      const soc = state.societies.find((s) => s.id === r.societyId);
      const grantCredits = soc?.initialCredits ?? 10;
      if (u) {
        u.societyId = r.societyId;
        u.householdId = r.householdId;
        u.creditBalance = (u.creditBalance || 0) + grantCredits;
      }
    }
    return delay(true);
  },
  reject: async (id: string) => {
    try {
      await apiFetch<any>(`/societies/join-requests/${id}/reject`, { method: "POST" });
      return true;
    } catch (err) {
      console.warn("[API Notice] reject joinRequest fallback:", err);
    }
    const r = state.joinRequests.find((x) => x.id === id);
    if (r) r.status = "rejected";
    return delay(true);
  },
  getByUserId: async (userId: string) => {
    try {
      const res = await apiFetch<any>("/societies/join-requests/me");
      if (res) return res;
    } catch (err: any) {
      if (err.message && !err.message.includes("404") && !err.message.includes("No active")) {
        console.warn("[API Notice] getByUserId joinRequest fallback:", err);
      }
    }
    return delay(state.joinRequests.find((r) => r.userId === userId && r.status === "pending") ?? null);
  },
  deleteRequest: async (id: string) => {
    try {
      await apiFetch<any>(`/societies/join-requests/${id}`, { method: "DELETE" });
      return true;
    } catch (err) {
      console.warn("[API Notice] deleteRequest joinRequest fallback:", err);
    }
    state.joinRequests = state.joinRequests.filter((x) => x.id !== id);
    return delay(true);
  },
};

// ---------------- Users / Residents ----------------
export const userService = {
  listBySociety: async (societyId: string) => {
    try {
      const res = await apiFetch<any[]>(`/users?society_id=${societyId}`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] listBySociety users fallback:", err);
    }
    return delay(state.users.filter((u) => u.societyId === societyId && u.role !== "admin"));
  },
  listCoordinators: async (societyId: string) => {
    try {
      const res = await apiFetch<any[]>(`/users/coordinators?society_id=${societyId}`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] listCoordinators fallback:", err);
    }
    return delay(state.users.filter((u) => u.societyId === societyId && u.isCoordinator));
  },
  promote: async (userId: string) => {
    try {
      await apiFetch<any>(`/users/${userId}/promote`, { method: "POST" });
      return true;
    } catch (err) {
      console.warn("[API Notice] promote user fallback:", err);
    }
    const u = state.users.find((x) => x.id === userId);
    if (u) {
      u.isCoordinator = true;
      u.role = "coordinator";
    }
    return delay(true);
  },
  demote: async (userId: string) => {
    try {
      await apiFetch<any>(`/users/${userId}/demote`, { method: "POST" });
      return true;
    } catch (err) {
      console.warn("[API Notice] demote user fallback:", err);
    }
    const u = state.users.find((x) => x.id === userId);
    if (u) {
      u.isCoordinator = false;
      u.role = "resident";
    }
    return delay(true);
  },
  updateProfile: async (userId: string, data: { name?: string; email?: string; societyName?: string }) => {
    try {
      const res = await apiFetch<any>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ name: data.name }),
      });
      if (res) return res;
    } catch (err) {
      console.warn("[API Notice] updateProfile fallback:", err);
    }
    const u = state.users.find((x) => x.id === userId);
    if (u && data.name) u.name = data.name;
    return delay(u ?? null);
  },
  updateOnboardingSurvey: async (
    userId: string,
    survey: { interests: string[]; offeredSkillsText: string; volunteerInterest: string },
  ) => {
    try {
      const res = await apiFetch<any>("/users/me/survey", {
        method: "POST",
        body: JSON.stringify({
          interests: survey.interests,
          offeredSkillsText: survey.offeredSkillsText,
          volunteerInterest: survey.volunteerInterest,
        }),
      });
      if (res) return res;
    } catch (err) {
      console.warn("[API Notice] updateOnboardingSurvey fallback:", err);
    }
    const u = state.users.find((x) => x.id === userId);
    if (u) {
      u.interests = survey.interests;
      u.offeredSkillsText = survey.offeredSkillsText;
      u.volunteerInterest = survey.volunteerInterest;
      u.hasCompletedSurvey = true;
    }
    return delay(u ?? null);
  },
  getSummary: async () => {
    try {
      const res = await apiFetch<any>("/users/me/summary");
      if (res) return res;
    } catch (err) {
      console.warn("[API Notice] getSummary fallback:", err);
    }
    return delay({ summary: "Your personalized community summary is being generated and will be available soon.", generated_at: null });
  },
};

// ---------------- Skills ----------------
export const skillService = {
  list: async (societyId?: string) => {
    try {
      const res = await apiFetch<any[]>(`/marketplace/skills?society_id=${societyId || ""}`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] list skills fallback:", err);
    }
    return delay(societyId ? state.skills.filter((s) => s.societyId === societyId) : state.skills);
  },
  listApproved: async (societyId: string) => {
    try {
      const res = await apiFetch<any[]>(`/marketplace/skills?society_id=${societyId}`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] listApproved skills fallback:", err);
    }
    return delay(state.skills.filter((s) => s.societyId === societyId && s.status === "approved"));
  },
  listPending: async (societyId: string) => {
    try {
      const res = await apiFetch<any[]>(`/marketplace/skills/pending?society_id=${societyId}`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] listPending skills fallback:", err);
    }
    return delay(state.skills.filter((s) => s.societyId === societyId && s.status === "pending"));
  },
  create: async (s: Omit<mock.Skill, "id" | "status">) => {
    try {
      const res = await apiFetch<any>("/marketplace/skills", {
        method: "POST",
        body: JSON.stringify({
          title: s.title,
          category: s.category,
          credits: s.credits,
          description: s.description,
          tags: s.tags,
        }),
      });
      if (res) return res;
    } catch (err) {
      console.warn("[API Notice] create skill fallback:", err);
    }
    const newSkill: mock.Skill = { ...s, id: uid("sk"), status: "pending" };
    state.skills.push(newSkill);
    return delay(newSkill);
  },
  approve: async (id: string) => {
    try {
      await apiFetch<any>(`/marketplace/skills/${id}/approve`, { method: "POST" });
      return true;
    } catch (err: any) {
      if (err.message) throw err;
    }
    const s = state.skills.find((x) => x.id === id);
    if (s) s.status = "approved";
    return delay(true);
  },
  reject: async (id: string) => {
    try {
      await apiFetch<any>(`/marketplace/skills/${id}/reject`, { method: "POST" });
      return true;
    } catch (err: any) {
      if (err.message) throw err;
    }
    const s = state.skills.find((x) => x.id === id);
    if (s) s.status = "rejected";
    return delay(true);
  },
  book: async (skillId: string, requesterId: string) => {
    try {
      await apiFetch<any>(`/marketplace/skills/${skillId}/book`, { method: "POST" });
      return true;
    } catch (err: any) {
      if (err.message) throw err;
    }
    const s = state.skills.find((x) => x.id === skillId);
    if (s) {
      const req = state.users.find((u) => u.id === requesterId);
      const prov = state.users.find((u) => u.id === s.providerId);
      if (req && prov && req.creditBalance >= s.credits) {
        req.creditBalance -= s.credits;
        prov.creditBalance += s.credits;
      }
    }
    return delay(true);
  },
};

// ---------------- Resources ----------------
export const resourceService = {
  list: async (societyId?: string) => {
    try {
      const res = await apiFetch<any[]>(`/marketplace/resources?society_id=${societyId || ""}`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] list resources fallback:", err);
    }
    return delay(societyId ? state.resources.filter((r) => r.societyId === societyId) : state.resources);
  },
  listApproved: async (societyId: string) => {
    try {
      const res = await apiFetch<any[]>(`/marketplace/resources?society_id=${societyId}`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] listApproved resources fallback:", err);
    }
    return delay(state.resources.filter((r) => r.societyId === societyId && r.status === "approved"));
  },
  listPending: async (societyId: string) => {
    try {
      const res = await apiFetch<any[]>(`/marketplace/resources/pending?society_id=${societyId}`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] listPending resources fallback:", err);
    }
    return delay(state.resources.filter((r) => r.societyId === societyId && r.status === "pending"));
  },
  create: async (r: Omit<mock.Resource, "id" | "status">) => {
    try {
      const res = await apiFetch<any>("/marketplace/resources", {
        method: "POST",
        body: JSON.stringify({
          name: r.name,
          category: r.category,
          credits: r.credits,
          description: r.description,
        }),
      });
      if (res) return res;
    } catch (err) {
      console.warn("[API Notice] create resource fallback:", err);
    }
    const newRes: mock.Resource = { ...r, id: uid("r"), status: "pending" };
    state.resources.push(newRes);
    return delay(newRes);
  },
  approve: async (id: string) => {
    try {
      await apiFetch<any>(`/marketplace/resources/${id}/approve`, { method: "POST" });
      return true;
    } catch (err: any) {
      if (err.message) throw err;
    }
    const r = state.resources.find((x) => x.id === id);
    if (r) r.status = "approved";
    return delay(true);
  },
  reject: async (id: string) => {
    try {
      await apiFetch<any>(`/marketplace/resources/${id}/reject`, { method: "POST" });
      return true;
    } catch (err: any) {
      if (err.message) throw err;
    }
    const r = state.resources.find((x) => x.id === id);
    if (r) r.status = "rejected";
    return delay(true);
  },
  borrow: async (resourceId: string, requesterId: string) => {
    try {
      await apiFetch<any>(`/marketplace/resources/${resourceId}/book`, { method: "POST" });
      return true;
    } catch (err: any) {
      if (err.message) throw err;
    }
    const r = state.resources.find((x) => x.id === resourceId);
    if (r && r.available) {
      r.available = false;
    }
    return delay(true);
  },
};

// ---------------- Credits ----------------
export const creditService = {
  getBalance: async (userId: string) => {
    try {
      const res = await apiFetch<{ creditBalance: number }>("/wallet/balance");
      if (res && res.creditBalance !== undefined) return res.creditBalance;
    } catch (err) {
      console.warn("[API Notice] getBalance fallback:", err);
    }
    const u = state.users.find((x) => x.id === userId) || getStoredUser();
    return delay(u?.creditBalance ?? 0);
  },
  getTransactions: async (userId: string) => {
    try {
      const res = await apiFetch<any[]>("/wallet/transactions");
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] getTransactions fallback:", err);
    }
    return delay(state.transactions.filter((t) => t.userId === userId));
  },
};

// ---------------- Events ----------------
export const eventService = {
  list: async (societyId: string) => {
    try {
      const res = await apiFetch<any[]>(`/events?society_id=${societyId}`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] list events fallback:", err);
    }
    return delay(state.events.filter((e) => e.societyId === societyId));
  },
  create: async (e: Omit<mock.EventItem, "id" | "volunteers" | "status"> & { startTime: string; endTime: string; color?: string; textColor?: string }) => {
    try {
      const res = await apiFetch<any>("/events", {
        method: "POST",
        body: JSON.stringify({
          title: e.title,
          startTime: e.startTime,
          endTime: e.endTime,
          description: e.description,
          volunteersNeeded: e.volunteersNeeded,
          color: e.color || "#dce8fb",
          textColor: e.textColor || "#1e3a6e",
        }),
      });
      if (res) return res;
    } catch (err: any) {
      if (err.message) throw err;
    }
    const ne: mock.EventItem = { ...e, id: uid("ev"), volunteers: [], status: "upcoming", color: e.color || "#dce8fb", textColor: e.textColor || "#1e3a6e" } as mock.EventItem;
    state.events.push(ne);
    return delay(ne);
  },
  listVolunteerRequests: async (societyId: string) => {
    try {
      const res = await apiFetch<any[]>(`/events/volunteers?society_id=${societyId}`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] listVolunteerRequests fallback:", err);
    }
    const eventIds = state.events.filter((e) => e.societyId === societyId).map((e) => e.id);
    return delay(state.volunteerRequests.filter((v) => eventIds.includes(v.eventId)));
  },
  requestVolunteer: async (eventId: string, residentId: string, residentName: string, eventTitle: string) => {
    try {
      const res = await apiFetch<any>(`/events/${eventId}/volunteer-requests`, { method: "POST" });
      if (res) return res;
    } catch (err) {
      console.warn("[API Notice] requestVolunteer fallback:", err);
    }
    const v: mock.VolunteerRequest = {
      id: uid("vr"),
      eventId,
      eventTitle,
      residentId,
      residentName,
      type: "self-requested",
      status: "pending",
    };
    state.volunteerRequests.push(v);
    return delay(v);
  },
  inviteVolunteer: async (eventId: string, residentId: string, residentName: string, eventTitle: string) => {
    try {
      const res = await apiFetch<any>(`/events/${eventId}/invite?resident_id=${residentId}`, { method: "POST" });
      if (res) return res;
    } catch (err) {
      console.warn("[API Notice] inviteVolunteer fallback:", err);
    }
    const v: mock.VolunteerRequest = {
      id: uid("vr"),
      eventId,
      eventTitle,
      residentId,
      residentName,
      type: "coordinator-invited",
      status: "pending",
    };
    state.volunteerRequests.push(v);
    return delay(v);
  },
  approveVolunteer: async (id: string) => {
    const v = state.volunteerRequests.find((x) => x.id === id);
    if (v) {
      try {
        await apiFetch<any>(`/events/${v.eventId}/volunteer-requests/${id}/approve`, { method: "POST" });
      } catch (err) {
        console.warn("[API Notice] approveVolunteer fallback:", err);
      }
      v.status = "approved";
    }
    return delay(true);
  },
  rejectVolunteer: async (id: string) => {
    const v = state.volunteerRequests.find((x) => x.id === id);
    if (v) {
      try {
        await apiFetch<any>(`/events/${v.eventId}/volunteer-requests/${id}/reject`, { method: "POST" });
      } catch (err) {
        console.warn("[API Notice] rejectVolunteer fallback:", err);
      }
      v.status = "rejected";
    }
    return delay(true);
  },
  leave: async (eventId: string, residentId: string, reason: string) => {
    try {
      await apiFetch<any>(`/events/${eventId}/leave?leave_reason=${encodeURIComponent(reason)}`, { method: "POST" });
      return true;
    } catch (err) {
      console.warn("[API Notice] leave event fallback:", err);
    }
    const ev = state.events.find((e) => e.id === eventId);
    if (ev) ev.volunteers = ev.volunteers.filter((uid) => uid !== residentId);
    return delay(true);
  },
};

// ---------------- Complaints ----------------
export const complaintService = {
  listSociety: async (societyId: string) => {
    try {
      const res = await apiFetch<any[]>(`/complaints?society_id=${societyId}`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] listSociety complaints fallback:", err);
    }
    return delay(state.complaints.filter((c) => c.societyId === societyId && !c.isAgainstCoordinator));
  },
  listPrivateAgainstCoordinators: async (societyId: string) => {
    try {
      const res = await apiFetch<any[]>(`/complaints/private-coordinators?society_id=${societyId}`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] listPrivateAgainstCoordinators complaints fallback:", err);
    }
    return delay(state.complaints.filter((c) => c.societyId === societyId && c.isAgainstCoordinator));
  },
  listForUser: async (userId: string) => {
    return delay(
      state.complaints.filter(
        (c) => !c.isAgainstCoordinator && (c.filedById === userId || c.involvedUserIds.includes(userId)),
      ),
    );
  },
  file: async (c: Omit<mock.Complaint, "id" | "status" | "createdAt" | "isAgainstCoordinator">) => {
    try {
      const res = await apiFetch<any>("/complaints", {
        method: "POST",
        body: JSON.stringify({
          title: c.title,
          category: c.category,
          description: c.description,
          priority: c.priority,
          targetCoordinatorId: c.targetCoordinatorId,
          isAgainstCoordinator: false,
        }),
      });
      if (res) return res;
    } catch (err) {
      console.warn("[API Notice] file complaint fallback:", err);
    }
    const nc: mock.Complaint = {
      ...c,
      id: uid("c"),
      status: "open",
      createdAt: new Date().toISOString().slice(0, 10),
      isAgainstCoordinator: false,
    };
    state.complaints.push(nc);
    return delay(nc);
  },
  fileAgainstCoordinator: async (
    c: Omit<mock.Complaint, "id" | "status" | "createdAt" | "isAgainstCoordinator" | "involvedUserIds">,
  ) => {
    try {
      const res = await apiFetch<any>("/complaints", {
        method: "POST",
        body: JSON.stringify({
          title: c.title,
          category: c.category,
          description: c.description,
          priority: c.priority,
          targetCoordinatorId: c.targetCoordinatorId,
          isAgainstCoordinator: true,
        }),
      });
      if (res) return res;
    } catch (err) {
      console.warn("[API Notice] fileAgainstCoordinator fallback:", err);
    }
    const nc: mock.Complaint = {
      ...c,
      id: uid("c"),
      status: "open",
      createdAt: new Date().toISOString().slice(0, 10),
      isAgainstCoordinator: true,
      involvedUserIds: [],
    };
    state.complaints.push(nc);
    return delay(nc);
  },
  takeAction: async (id: string, action: "in-review" | "resolved" | "dismissed") => {
    try {
      await apiFetch<any>(`/complaints/${id}/status?new_status=${action}`, { method: "PUT" });
      return true;
    } catch (err) {
      console.warn("[API Notice] takeAction complaint fallback:", err);
    }
    const c = state.complaints.find((x) => x.id === id);
    if (c) c.status = action;
    return delay(true);
  },
};

// ---------------- Notices ----------------
export const noticeService = {
  list: async (societyId: string) => {
    try {
      const res = await apiFetch<any[]>(`/notices?societyId=${societyId}`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] list notices fallback:", err);
    }
    return delay(state.notices.filter((n) => n.societyId === societyId));
  },
  post: async (n: Omit<mock.Notice, "id" | "date">) => {
    try {
      const res = await apiFetch<any>("/notices", {
        method: "POST",
        body: JSON.stringify({
          societyId: n.societyId,
          title: n.title,
          content: n.content,
          category: n.category,
        }),
      });
      if (res) return res;
    } catch (err) {
      console.warn("[API Notice] post notice fallback:", err);
    }
    const nn: mock.Notice = { ...n, id: uid("n"), date: new Date().toISOString().slice(0, 10) };
    state.notices.unshift(nn);
    return delay(nn);
  },
  delete: async (id: string) => {
    try {
      await apiFetch<any>(`/notices/${id}`, { method: "DELETE" });
      return true;
    } catch (err) {
      console.warn("[API Notice] delete notice fallback:", err);
    }
    const i = state.notices.findIndex((x) => x.id === id);
    if (i >= 0) state.notices.splice(i, 1);
    return delay(true);
  },
  hasPostedToday: async (userId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    return delay(state.notices.some((n) => n.postedById === userId && n.date === today));
  },
};

// ---------------- Chat ----------------
export const chatService = {
  getMessages: async (userA: string, userB: string) => {
    try {
      const res = await apiFetch<any[]>(`/chat/messages?otherUserId=${userB}`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("[API Notice] getMessages chat fallback:", err);
    }
    return delay(
      state.chat.filter(
        (m) =>
          (m.senderId === userA && m.receiverId === userB) ||
          (m.senderId === userB && m.receiverId === userA),
      ),
    );
  },
  sendMessage: async (senderId: string, senderName: string, receiverId: string, content: string) => {
    try {
      const res = await apiFetch<any>("/chat/messages", {
        method: "POST",
        body: JSON.stringify({ receiverId, content }),
      });
      if (res) return res;
    } catch (err) {
      console.warn("[API Notice] sendMessage chat fallback:", err);
    }
    const m: mock.ChatMessage = {
      id: uid("m"),
      senderId,
      senderName,
      receiverId,
      content,
      timestamp: new Date().toISOString(),
    };
    state.chat.push(m);
    return delay(m);
  },
};

export { state as __mockState };
