# Community Exchange Network (CEN)

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.12-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%7C%20TypeScript-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Bundler-Vite%206-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev)
[![TailwindCSS](https://img.shields.io/badge/Styling-TailwindCSS%20v4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Pytest](https://img.shields.io/badge/Tests-53%2F53%20Passing-brightgreen.svg?logo=pytest&logoColor=white)](https://docs.pytest.org)
[![Google Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini%202.5-4285F4.svg?logo=google&logoColor=white)](https://ai.google.dev)

A comprehensive, hyper-local community empowerment and mutual-aid platform designed for gated residential societies, apartment complexes, and neighborhood associations. **CEN** facilitates peer-to-peer skill exchanges, physical resource sharing, transparent community governance, event coordination, volunteer matching, and dispute arbitration — powered by a resilient time-banking credit economy and Google Gemini AI.

---

## 🌟 Key Capabilities & Modules

### 1. 🤝 Time-Banking Marketplace (Skills & Shared Resources)
* **Skill Sessions**: Offer or book music lessons, home repairs, tech tutorials, fitness coaching, and tutoring using time-based community credits.
* **Shared Physical Tool Library**: Borrow and lend lawnmowers, ladders, drills, projectors, and board games without recurring rental costs.
* **Credit Escrow & Anti-Self-Approval**: Dual-key booking confirmation with automated credit escrow and strict moderation anti-self-approval guards.
* **Moderation Workflow**: Coordinators approve/reject submissions with mandatory feedback remarks; residents can edit and resubmit revised offerings.

### 2. 📅 Community Events & Volunteer Matchmaker
* **Interactive Calendar**: Full-featured Monthly and 7-Day Weekly views with intuitive navigation and color-coded themes.
* **AI Schedule Clash Detection**: Analyzes proposed event times against existing community schedules to prevent overlaps and suggest optimal time slots.
* **Dynamic AI Volunteer Matchmaker**: Matches resident profiles, survey interests, and offered skills with event requirements (scores 62%–98%) with contextual reasons.
* **Transparent Moderation**: Decline volunteer applications with customizable reason presets; residents receive clear explanations with a one-click **Re-apply** option; coordinators can **Re-invite** previous applicants if openings arise.
* **Full Event Lifecycle**: Coordinators can create, edit, complete, and cancel/delete community events with automatic roster cleanup.

### 3. 🗳️ Democratic Governance, Complaints & Dispute Resolution
* **Community Polling**: Create time-bounded single-choice or multi-choice polls with live percentage visualizations and participation quorum tracking.
* **Grievance Redressal**: File public or private maintenance complaints with administrative resolution tracking.
* **Secondary Dispute Justification**: Formal trade disputes require explicit justifications from both buyer and provider before coordinator arbitration and escrow release.

### 4. 🛡️ Multi-Tenancy, Role-Based Access Control (RBAC) & ID Verification
* **4-Tier Role Hierarchy**:
  * **Platform Owner**: Global platform analytics, society application approvals, household capacity limits, and community suspension controls.
  * **Society Admin**: Society onboarding, key generation, household capacity enforcement, coordinator appointments.
  * **Event/Marketplace Coordinator**: Moderates listings, arbitrates disputes, manages volunteer rosters.
  * **Resident**: Trades skills, borrows resources, files grievances, votes on polls, volunteers for events.
* **Identity Verification Lifecycle**: Single-step auto-verification on society join approval with document inspection viewer (PNG, JPG, PDF) and multi-state status badges (*Unverified*, *Pending Review*, *Verified*).
* **Operational Gating**: Society marketplace and event creation are safely held until >= 2 coordinators are registered.

### 5. 🤖 Google Gemini AI Assistant & Semantic Search (100% Fallback Resilient)
* **Resident Chatbot**: Society-grounded conversational assistant answering FAQs, guidelines, and amenities questions.
* **Marketplace RAG Search**: Semantic natural language search matching user queries against the live society catalog.
* **Notice Board Summarizer**: AI-generated 2-bullet key takeaway digests for long society circulars.
* **Complaint Priority Classifier**: Auto-categorizes grievances and assigns priority urgency levels.
* **Deterministic Fallback Engine**: Every AI endpoint includes heuristic fallback algorithms ensuring 100% uptime with zero crashes even if offline or rate-limited.

---

## 🏗️ Repository Architecture

`
MAY2026-Team-094/
├── backend/                  # FastAPI REST API Backend
│   ├── src/
│   │   ├── ai/               # Gemini AI services, prompts & deterministic heuristics
│   │   ├── analytics/        # Platform owner & society health metrics
│   │   ├── auth/             # JWT auth, password reset, and registration
│   │   ├── complaints/       # Facility grievances & auditing
│   │   ├── disputes/         # Trade dispute arbitration & escrow
│   │   ├── events/           # Community assemblies & volunteer rosters
│   │   ├── marketplace/      # Skill exchanges & shared resource catalog
│   │   ├── societies/        # Multi-tenant societies, households, & approvals
│   │   ├── users/            # Profiles, preferences survey, and ID verification
│   │   ├── wallet/           # Timebank credit transfers & transaction ledger
│   │   ├── database.py       # SQLAlchemy SQLite/PostgreSQL engine
│   │   └── main.py           # FastAPI entrypoint and CORS configuration
│   ├── tests/                # 52 Pytest integration & unit test suites
│   ├── requirements.txt      # Python dependencies
│   ├── run_tests.py          # Unified test runner
│   └── README.md             # Backend detailed documentation
│
├── frontend/                 # React 19 + TypeScript + Vite Single Page App
│   ├── src/
│   │   ├── components/       # Radix UI, EventCalendar, AppShell, ExchangeCards
│   │   ├── routes/           # TanStack file-based routes (Owner, Admin, Coord, Resident)
│   │   ├── services/         # API clients, Gemini AI integrations, and offline state
│   │   ├── lib/              # Auth context, utilities, and date formatters
│   │   └── mocks/            # Type definitions & mock state fallback
│   ├── package.json          # Node dependencies & npm scripts
│   ├── vite.config.ts        # Vite configuration & TanStack router plugin
│   └── README.md             # Frontend detailed documentation
│
├── PROJECT_MASTER_DOCUMENTATION.md  # Comprehensive system blueprint & API catalog
├── PROJECT_STATE_SUMMARY.md         # Milestone state & verification summary
└── README.md                        # Monorepo root overview
`

---

## 🚀 Local Development Setup

### 1. Prerequisites
- **Python 3.10+** (Python 3.12 recommended)
- **Node.js 18+** & npm
- **Git**

---

### 2. Backend Setup (FastAPI)

`ash
# Navigate to backend directory
cd backend

# Create & activate virtual environment
# Windows:
python -m venv venv
venv\Scripts\activate

# macOS / Linux:
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# Windows:
copy .env.example .env
# macOS / Linux:
cp .env.example .env

# Start FastAPI backend server (runs on http://127.0.0.1:8000)
uvicorn src.main:app --reload --port 8000
`

*Interactive API Docs:*
- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

---

### 3. Frontend Setup (React 19 + Vite)

Open a second terminal window:

`ash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server (runs on http://localhost:3000)
npm run dev
`

Open your browser and visit: **http://localhost:3000**

---

## 🧪 Test Suites & Code Quality

### Run Full Backend Test Suite (Pytest)
`ash
cd backend
venv\Scripts\python run_tests.py   # Windows
# or
./venv/bin/python run_tests.py     # macOS / Linux
`
*Expected Result:* **52 passed in ~55s (100% pass rate)**

### Run Frontend Typecheck
`ash
cd frontend
npx tsc --noEmit
`
*Expected Result:* **0 errors**

---

## 🔐 Core Architecture Principles

1. **Zero Regressions & Deterministic Test Suites**: Every feature change is strictly validated against the 52-test automated regression suite.
2. **Resilient AI Fallbacks**: All 8 AI features are designed to fail gracefully into deterministic heuristics without service disruption.
3. **Strict Multi-Tenant & RBAC Isolation**: All data is strictly gated by society_id and role permissions across all database operations and REST endpoints.

---

## 📄 License & Team
Developed for **MAY2026-Team-094** / **Community Exchange Network (CEN)**.
