# Community Exchange Network (CEN) — FastAPI Backend API

This repository contains the RESTful FastAPI backend for the **Community Exchange Network (CEN)** platform — a hyper-local time-banking, skill discovery, and resource-sharing application built for residential societies.

---

## 🚀 Quick Start & Installation

### Prerequisites
- **Python 3.10+** (Python 3.10, 3.11, or 3.12 recommended)
- `pip` package manager

---

### Step 1: Clone & Navigate to Backend
```bash
git clone <repository-url>
cd backend
```

---

### Step 2: Set Up Virtual Environment

#### **Windows (Command Prompt / PowerShell):**
```cmd
python -m venv venv
venv\Scripts\activate
```

#### **macOS / Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

---

### Step 3: Install Dependencies

```bash
pip install .
```
*Alternatively, install using standard setuptools:*
```bash
pip install fastapi "uvicorn[standard]" sqlalchemy pydantic pydantic-settings pyjwt passlib python-multipart httpx python-dotenv pytest pytest-asyncio
```

---

### Step 4: Configure Environment Variables

Create a local `.env` file by copying the template file:

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Open `.env` in any text editor and fill in your local values:

```env
PROJECT_NAME="CEN — Community Exchange Network API"
API_V1_STR="/api/v1"
SECRET_KEY="your-secret-key-for-jwt-signing"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# (Optional) Google Gemini API Key for AI features (Auto-tagging, Chatbot, ID Proof Vision)
GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"

# Local SQLite Database URL
DATABASE_URL="sqlite:///./cen.db"
```

> ⚠️ **Security Notice**: Never commit real secret keys or Gemini API keys to public repositories.

---

### Step 5: Seed Demo Data (Optional but Recommended)

To seed the local database with pre-populated demo societies, households, users, skills, and resources:

```bash
python src/seed.py
```

---

### Step 6: Run the FastAPI Server

Start the live backend server using Uvicorn:

```bash
python -m uvicorn src.main:app --host 127.0.0.1 --port 8000 --reload
```

The backend server will start at **`http://127.0.0.1:8000`**.

- **Interactive Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc API Documentation**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **Health Check Endpoint**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

---

## 🧪 Running Pytest Automated Tests

To run the complete automated test suite (31 integration & unit tests):

```bash
python run_tests.py
```

Or run via `pytest` directly with verbose output:

```bash
pytest tests/ -v
```

To run with coverage reporting:

```bash
pytest tests/ --cov=src --cov-report=term-missing
```

---

## 🔑 Demo Account Credentials

| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| **Platform Owner** | `owner@cen.app` | `password123` | Platform setup approvals, cross-society analytics |
| **Society Admin** | `admin@cen.app` | `password123` | Resident onboarding, unit registry, notices broadcast |
| **Coordinator** | `coord@cen.app` | `password123` | Listing moderation, volunteer rosters, dispute audits |
| **Resident** | `resident@cen.app` | `password123` | Skill exchange, resource lending, wallet transfers |

---

## 📁 Directory Structure Overview

```text
backend/
├── pyproject.toml        # Project dependencies and configuration
├── .env.example          # Environment variable template (No secret keys)
├── README.md             # Setup and instruction manual
├── run_tests.py          # Pytest runner helper script
├── src/                  # Core FastAPI Application
│   ├── auth/             # JWT Authentication & Passwords
│   ├── users/            # Resident Profile Management & RBAC
│   ├── societies/        # Society Onboarding & Household Slots
│   ├── wallet/           # Time-Credit Banking & Ledger
│   ├── marketplace/      # Skill Exchange & Resource Lending
│   ├── events/           # Community Events & Volunteering
│   ├── complaints/       # Facility Complaints & Audits
│   ├── notices/          # Noticeboard Broadcasts
│   ├── chat/             # Direct Resident Messaging
│   ├── ai/               # Gemini AI Chatbot, Vision ID, Auto-Tagging
│   ├── analytics/        # Owner & Admin Performance Metrics
│   ├── config.py         # Application settings
│   ├── database.py       # SQLAlchemy engine & session maker
│   └── main.py           # FastAPI application entry point
└── tests/                # Pytest Test Suite (31 test cases)
```
