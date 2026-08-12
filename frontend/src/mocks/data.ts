// ============================================================================
// MOCK DATA — Community Exchange Network (CEN)
// ----------------------------------------------------------------------------
// This is the single source of mock/placeholder data for the entire frontend.
// TODO: Replace all of this with real backend API calls (see src/services/*).
// ============================================================================

export type Role = "owner" | "admin" | "coordinator" | "resident";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  societyId?: string;
  householdId?: string;
  creditBalance: number;
  joinedDate: string;
  idProofUploaded: boolean;
  isCoordinator: boolean;
  avatarColor?: string;
  interests?: string[];
  offeredSkillsText?: string;
  volunteerInterest?: string;
  hasCompletedSurvey?: boolean;
}

export interface Society {
  id: string;
  name: string;
  type: string;
  address: string;
  latitude: number;
  longitude: number;
  adminId: string;
  capacity: number;
  initialCredits: number;
  householdRangeStart: number;
  householdRangeEnd: number;
  coordinatorCount: number;
  status: "pending" | "active" | "suspended";
  performanceScore: number;
  key: string;
}

export interface Household {
  id: string;
  societyId: string;
  unitNumber: string;
  claimed: boolean;
  claimedByUserId?: string;
}

export interface SocietyApplication {
  id: string;
  societyName: string;
  type: string;
  address: string;
  applicantName: string;
  applicantContact: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  residentCount?: number;
  initialCredits?: number;
}

export interface JoinRequest {
  id: string;
  userId: string;
  userName: string;
  societyId: string;
  householdId: string;
  unitNumber: string;
  idProofUrl: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
}

export interface Skill {
  id: string;
  title: string;
  category: string;
  providerId: string;
  providerName: string;
  credits: number;
  description: string;
  status: "pending" | "approved" | "rejected";
  tags: string[];
  societyId: string;
}

export interface Resource {
  id: string;
  name: string;
  category: string;
  ownerId: string;
  ownerName: string;
  available: boolean;
  credits: number;
  status: "pending" | "approved" | "rejected";
  description: string;
  societyId: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: "earned" | "spent";
  amount: number;
  description: string;
  date: string;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  createdByCoordinatorId: string;
  volunteersNeeded: number;
  volunteers: string[];
  status: "upcoming" | "completed";
  societyId: string;
  color?: string;
  textColor?: string;
}

export interface VolunteerRequest {
  id: string;
  eventId: string;
  eventTitle: string;
  residentId: string;
  residentName: string;
  type: "self-requested" | "coordinator-invited";
  status: "pending" | "approved" | "rejected" | "left";
  leaveReason?: string;
}

export interface Complaint {
  id: string;
  filedById: string;
  filedByName: string;
  involvedUserIds: string[];
  subject: string;
  title?: string;
  description: string;
  category: string;
  priority?: "low" | "medium" | "high";
  status: "open" | "in-review" | "resolved" | "dismissed";
  isAgainstCoordinator: boolean;
  targetCoordinatorId?: string;
  assignedCoordinatorId?: string;
  societyId: string;
  createdAt: string;
}

export interface Notice {
  id: string;
  postedById: string;
  postedByName: string;
  posterRole: Role;
  title: string;
  content: string;
  category?: string;
  date: string;
  societyId: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string; // user id or "chatbot"
  content: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Seed data — one society "Green Meadows" fully populated so all dashboards
// have something to display.
// ---------------------------------------------------------------------------

export const societies: Society[] = [
  {
    id: "soc-fresh",
    name: "Fresh Vista Community",
    type: "Residential Apartment",
    address: "77 Orchid Boulevard, Bengaluru",
    latitude: 12.96,
    longitude: 77.58,
    adminId: "u-freshadmin",
    capacity: 150,
    initialCredits: 10,
    householdRangeStart: 1,
    householdRangeEnd: 150,
    coordinatorCount: 0,
    status: "active",
    performanceScore: 100,
    key: "FRESH-VISTA",
  },
  {
    id: "soc-demo",
    name: "Green Meadows Residency",
    type: "Residential Apartment",
    address: "12 Park Ave, Bengaluru",
    latitude: 12.97,
    longitude: 77.59,
    adminId: "u-admin",
    capacity: 200,
    initialCredits: 15,
    householdRangeStart: 101,
    householdRangeEnd: 320,
    coordinatorCount: 2,
    status: "active",
    performanceScore: 87,
    key: "GREEN-2024",
  },
  {
    id: "soc-2",
    name: "Sunrise Cultural Society",
    type: "Cultural",
    address: "44 MG Road, Bengaluru",
    latitude: 12.98,
    longitude: 77.6,
    adminId: "u-admin2",
    capacity: 120,
    initialCredits: 10,
    householdRangeStart: 1,
    householdRangeEnd: 120,
    coordinatorCount: 3,
    status: "active",
    performanceScore: 72,
    key: "SUNRISE-01",
  },
  {
    id: "soc-3",
    name: "Lakeside NGO Hub",
    type: "NGO",
    address: "5 Lakeview Rd, Bengaluru",
    latitude: 12.95,
    longitude: 77.62,
    adminId: "u-admin3",
    capacity: 80,
    initialCredits: 20,
    householdRangeStart: 1,
    householdRangeEnd: 80,
    coordinatorCount: 1,
    status: "active",
    performanceScore: 65,
    key: "LAKESIDE-9",
  },
];

export const users: User[] = [
  {
    id: "u-freshadmin",
    name: "Fresh Admin",
    email: "freshadmin@cen.app",
    role: "admin",
    societyId: "soc-fresh",
    creditBalance: 100,
    joinedDate: "2026-07-18",
    idProofUploaded: true,
    isCoordinator: false,
    avatarColor: "#ec4899",
    hasCompletedSurvey: true,
  },
  {
    id: "u-owner",
    name: "Priya Owner",
    email: "owner@cen.app",
    role: "owner",
    creditBalance: 0,
    joinedDate: "2024-01-01",
    idProofUploaded: true,
    isCoordinator: false,
    avatarColor: "#7c3aed",
    hasCompletedSurvey: true,
  },
  {
    id: "u-admin",
    name: "Ravi Admin",
    email: "admin@cen.app",
    role: "admin",
    societyId: "soc-demo",
    creditBalance: 0,
    joinedDate: "2024-02-10",
    idProofUploaded: true,
    isCoordinator: false,
    avatarColor: "#0ea5e9",
    hasCompletedSurvey: true,
  },
  {
    id: "u-coord",
    name: "Meera Coordinator",
    email: "coord@cen.app",
    role: "coordinator",
    societyId: "soc-demo",
    householdId: "h-101",
    creditBalance: 42,
    joinedDate: "2024-03-01",
    idProofUploaded: true,
    isCoordinator: true,
    avatarColor: "#14b8a6",
    hasCompletedSurvey: true,
  },
  {
    id: "u-coord2",
    name: "Arjun Coordinator",
    email: "coord2@cen.app",
    role: "coordinator",
    societyId: "soc-demo",
    householdId: "h-102",
    creditBalance: 30,
    joinedDate: "2024-03-05",
    idProofUploaded: true,
    isCoordinator: true,
    avatarColor: "#f59e0b",
    hasCompletedSurvey: true,
  },
  {
    id: "u-res",
    name: "Anaya Resident",
    email: "resident@cen.app",
    role: "resident",
    societyId: "soc-demo",
    householdId: "h-103",
    creditBalance: 25,
    joinedDate: "2024-04-12",
    idProofUploaded: true,
    isCoordinator: false,
    avatarColor: "#ef4444",
    hasCompletedSurvey: true,
  },
  {
    id: "u-res2",
    name: "Karan Resident",
    email: "karan@cen.app",
    role: "resident",
    societyId: "soc-demo",
    householdId: "h-104",
    creditBalance: 15,
    joinedDate: "2024-05-01",
    idProofUploaded: true,
    isCoordinator: false,
    avatarColor: "#8b5cf6",
    hasCompletedSurvey: true,
  },
  {
    id: "u-res3",
    name: "Sana Resident",
    email: "sana@cen.app",
    role: "resident",
    societyId: "soc-demo",
    householdId: "h-105",
    creditBalance: 50,
    joinedDate: "2024-05-15",
    idProofUploaded: true,
    isCoordinator: false,
    avatarColor: "#22c55e",
    hasCompletedSurvey: true,
  },
];

export const households: Household[] = Array.from({ length: 20 }, (_, i) => {
  const unit = 101 + i;
  const claimedIdx: Record<number, string> = {
    101: "u-coord",
    102: "u-coord2",
    103: "u-res",
    104: "u-res2",
    105: "u-res3",
  };
  return {
    id: `h-${unit}`,
    societyId: "soc-demo",
    unitNumber: `A-${unit}`,
    claimed: !!claimedIdx[unit],
    claimedByUserId: claimedIdx[unit],
  };
});

export const societyApplications: SocietyApplication[] = [
  {
    id: "app-1",
    societyName: "Palm Grove Apartments",
    type: "Residential Apartment",
    address: "22 Palm Rd, Bengaluru",
    applicantName: "Neha Kapoor",
    applicantContact: "neha@palmgrove.in",
    reason: "We want a structured way for residents to help each other.",
    status: "pending",
    submittedAt: "2026-06-20",
    residentCount: 150,
    initialCredits: 10,
  },
  {
    id: "app-2",
    societyName: "Harmony NGO",
    type: "NGO",
    address: "9 Peace St, Bengaluru",
    applicantName: "Vikram Rao",
    applicantContact: "vikram@harmony.org",
    reason: "Volunteer coordination platform for our NGO members.",
    status: "pending",
    submittedAt: "2026-07-01",
    residentCount: 80,
    initialCredits: 15,
  },
];

export const joinRequests: JoinRequest[] = [
  {
    id: "jr-1",
    userId: "u-newres",
    userName: "Rohit Sharma",
    societyId: "soc-demo",
    householdId: "h-106",
    unitNumber: "A-106",
    idProofUrl: "mock://id-proof-1.pdf",
    status: "pending",
    submittedAt: "2026-07-10",
  },
  {
    id: "jr-2",
    userId: "u-newres2",
    userName: "Divya Patel",
    societyId: "soc-demo",
    householdId: "h-107",
    unitNumber: "A-107",
    idProofUrl: "mock://id-proof-2.pdf",
    status: "pending",
    submittedAt: "2026-07-12",
  },
];

export const skills: Skill[] = [
  {
    id: "sk-1",
    title: "Bicycle Repair & Tuning",
    category: "Repair",
    providerId: "u-res",
    providerName: "Anaya Resident",
    credits: 3,
    description: "10 years fixing bikes. Full tune-up, brake adjustment, flat fixes.",
    status: "approved",
    tags: ["bike", "repair", "cycling"],
    societyId: "soc-demo",
  },
  {
    id: "sk-2",
    title: "Math Tutoring (Grades 6-10)",
    category: "Tutoring",
    providerId: "u-res2",
    providerName: "Karan Resident",
    credits: 5,
    description: "One-hour sessions covering algebra, geometry, and basic calculus.",
    status: "approved",
    tags: ["math", "tutoring", "education"],
    societyId: "soc-demo",
  },
  {
    id: "sk-3",
    title: "Home Yoga Classes",
    category: "Wellness",
    providerId: "u-res3",
    providerName: "Sana Resident",
    credits: 4,
    description: "Gentle yoga sessions suitable for beginners and seniors.",
    status: "approved",
    tags: ["yoga", "wellness", "fitness"],
    societyId: "soc-demo",
  },
  {
    id: "sk-4",
    title: "Basic Plumbing Fixes",
    category: "Repair",
    providerId: "u-res",
    providerName: "Anaya Resident",
    credits: 2,
    description: "Leaky taps, blocked drains, minor pipe fixes.",
    status: "pending",
    tags: ["plumbing", "repair"],
    societyId: "soc-demo",
  },
  {
    id: "sk-5",
    title: "Guitar Lessons for Beginners",
    category: "Music",
    providerId: "u-coord",
    providerName: "Meera Coordinator",
    credits: 4,
    description: "Learn chords and simple songs. Bring your own guitar.",
    status: "pending",
    tags: ["guitar", "music", "lessons"],
    societyId: "soc-demo",
  },
];

export const resources: Resource[] = [
  {
    id: "r-1",
    name: "DSLR Camera (Canon 80D)",
    category: "Electronics",
    ownerId: "u-res2",
    ownerName: "Karan Resident",
    available: true,
    credits: 6,
    status: "approved",
    description: "Good for photoshoots. Includes 50mm lens.",
    societyId: "soc-demo",
  },
  {
    id: "r-2",
    name: "Power Drill Set",
    category: "Tools",
    ownerId: "u-res",
    ownerName: "Anaya Resident",
    available: true,
    credits: 2,
    status: "approved",
    description: "Cordless drill with full bit set.",
    societyId: "soc-demo",
  },
  {
    id: "r-3",
    name: "Portable Projector",
    category: "Electronics",
    ownerId: "u-res3",
    ownerName: "Sana Resident",
    available: false,
    credits: 5,
    status: "approved",
    description: "1080p projector — great for movie nights.",
    societyId: "soc-demo",
  },
  {
    id: "r-4",
    name: "Camping Tent (4-person)",
    category: "Outdoor",
    ownerId: "u-coord2",
    ownerName: "Arjun Coordinator",
    available: true,
    credits: 4,
    status: "pending",
    description: "Waterproof tent, easy setup.",
    societyId: "soc-demo",
  },
];

export const transactions: Transaction[] = [
  { id: "t-1", userId: "u-res", type: "earned", amount: 5, description: "Bike repair for Karan", date: "2026-07-01" },
  { id: "t-2", userId: "u-res", type: "spent", amount: 4, description: "Yoga class with Sana", date: "2026-07-05" },
  { id: "t-3", userId: "u-res", type: "earned", amount: 3, description: "Bike tune-up for Meera", date: "2026-07-10" },
  { id: "t-4", userId: "u-res", type: "spent", amount: 2, description: "Borrowed drill from herself (test)", date: "2026-07-12" },
  { id: "t-5", userId: "u-coord", type: "earned", amount: 4, description: "Guitar lesson for Karan", date: "2026-07-08" },
];

export const events: EventItem[] = [
  {
    id: "ev-1",
    title: "Community Cleanup Day",
    description: "Help us tidy up the shared garden and common areas.",
    startTime: "2026-08-05T09:00:00Z",
    endTime: "2026-08-05T12:00:00Z",
    createdByCoordinatorId: "u-coord",
    volunteersNeeded: 8,
    volunteers: ["u-res2"],
    status: "upcoming",
    societyId: "soc-demo",
  },
  {
    id: "ev-2",
    title: "Kids Art Workshop",
    description: "Weekend art session for children aged 6-12.",
    startTime: "2026-08-12T10:00:00Z",
    endTime: "2026-08-12T13:00:00Z",
    createdByCoordinatorId: "u-coord2",
    volunteersNeeded: 4,
    volunteers: [],
    status: "upcoming",
    societyId: "soc-demo",
  },
  {
    id: "ev-3",
    title: "Diwali Potluck",
    description: "Bring a dish and celebrate together.",
    startTime: "2026-11-01T18:00:00Z",
    endTime: "2026-11-01T22:00:00Z",
    createdByCoordinatorId: "u-coord",
    volunteersNeeded: 6,
    volunteers: ["u-res", "u-res3"],
    status: "upcoming",
    societyId: "soc-demo",
  },
];

export const volunteerRequests: VolunteerRequest[] = [
  {
    id: "vr-1",
    eventId: "ev-1",
    eventTitle: "Community Cleanup Day",
    residentId: "u-res",
    residentName: "Anaya Resident",
    type: "self-requested",
    status: "pending",
  },
  {
    id: "vr-2",
    eventId: "ev-2",
    eventTitle: "Kids Art Workshop",
    residentId: "u-res3",
    residentName: "Sana Resident",
    type: "coordinator-invited",
    status: "pending",
  },
];

export const complaints: Complaint[] = [
  {
    id: "c-1",
    filedById: "u-res",
    filedByName: "Anaya Resident",
    involvedUserIds: ["u-res2"],
    subject: "Noise late at night",
    description: "Repeated loud noise past 11pm from A-104.",
    category: "Noise",
    priority: "medium",
    status: "open",
    isAgainstCoordinator: false,
    assignedCoordinatorId: "u-coord",
    societyId: "soc-demo",
    createdAt: "2026-07-08",
  },
  {
    id: "c-2",
    filedById: "u-res3",
    filedByName: "Sana Resident",
    involvedUserIds: [],
    subject: "Shared garden being misused",
    description: "Some residents parking bikes on the lawn.",
    category: "Facilities",
    priority: "low",
    status: "in-review",
    isAgainstCoordinator: false,
    assignedCoordinatorId: "u-coord2",
    societyId: "soc-demo",
    createdAt: "2026-07-11",
  },
  // Private (against coordinator) — visible only to admin
  {
    id: "c-p1",
    filedById: "u-res2",
    filedByName: "Karan Resident",
    involvedUserIds: [],
    subject: "Coordinator behaviour concern",
    description: "Coordinator was dismissive when I raised an issue.",
    category: "Coordinator Conduct",
    priority: "high",
    status: "open",
    isAgainstCoordinator: true,
    targetCoordinatorId: "u-coord",
    societyId: "soc-demo",
    createdAt: "2026-07-14",
  },
];

export const notices: Notice[] = [
  {
    id: "n-1",
    postedById: "u-admin",
    postedByName: "Ravi Admin",
    posterRole: "admin",
    title: "Water tank cleaning on Saturday",
    content:
      "Water supply will be interrupted from 9am to 2pm on Saturday for scheduled cleaning of the main storage tanks. Please store enough water in advance. Regular supply will resume by evening. Thank you for your cooperation and patience during this maintenance activity.",
    date: "2026-07-15",
    societyId: "soc-demo",
  },
  {
    id: "n-2",
    postedById: "u-coord",
    postedByName: "Meera Coordinator",
    posterRole: "coordinator",
    title: "Yoga class location changed",
    content: "This week's yoga class moves to the terrace.",
    date: "2026-07-16",
    societyId: "soc-demo",
  },
  {
    id: "n-3",
    postedById: "u-res",
    postedByName: "Anaya Resident",
    posterRole: "resident",
    title: "Lost keys near lobby",
    content: "Found a set of keys near the lobby. Please contact me at A-103.",
    date: "2026-07-17",
    societyId: "soc-demo",
  },
];

export const chatMessages: ChatMessage[] = [
  {
    id: "m-1",
    senderId: "u-res2",
    senderName: "Karan",
    receiverId: "u-res",
    content: "Hey, is your bicycle repair slot open this weekend?",
    timestamp: "2026-07-16T10:00:00Z",
  },
  {
    id: "m-2",
    senderId: "u-res",
    senderName: "Anaya",
    receiverId: "u-res2",
    content: "Yes! Saturday afternoon works.",
    timestamp: "2026-07-16T10:05:00Z",
  },
  {
    id: "m-3",
    senderId: "u-res",
    senderName: "Anaya",
    receiverId: "chatbot",
    content: "What's my credit balance?",
    timestamp: "2026-07-17T09:00:00Z",
  },
  {
    id: "m-4",
    senderId: "chatbot",
    senderName: "CEN Assistant",
    receiverId: "u-res",
    content: "You currently have 25 credits. You've earned 8 and spent 6 in the last week.",
    timestamp: "2026-07-17T09:00:02Z",
  },
];
