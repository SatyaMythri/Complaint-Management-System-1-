# Complaint Management System

A full-stack MERN application for submitting, tracking, and resolving complaints — with role-based access control (citizen / staff / admin), SLA tracking, a full audit trail, and cloud-hosted attachments. Built with a focus on security, testability, and correctness at scale.

## Features

- **Authentication & security** — JWT-based sessions, bcrypt password hashing, rate limiting on login/register/OTP endpoints, `helmet` security headers, and server-side input validation (`express-validator`) on every write endpoint.
- **Role-based access control** — Three roles: **citizen** (submits complaints), **staff** (works complaints assigned to them), **admin** (full access, manages staff, assigns work). Enforced server-side, not just hidden in the UI.
- **Complaint lifecycle & audit trail** — Every status change is appended to a `history` timeline (who changed what, when) instead of overwriting a single `remarks` field.
- **SLA tracking** — Configurable per-priority resolution targets (High: 24h / Medium: 72h / Low: 168h). Complaints are automatically flagged as On Track, Due Soon, Overdue (open) or Met, Breached (resolved). A dedicated overdue queue endpoint powers a live "Show overdue only" view.
- **Staff assignment** — Admins assign complaints to staff members; staff only see and can act on complaints assigned to them.
- **Multiple attachments** — Up to 5 images/PDFs per complaint, uploaded directly to **Cloudinary** (not local disk, so uploads persist across deploys/restarts).
- **Pagination, search & filtering** — Complaint lists are paginated and filterable server-side (status, category, priority, assignee, free-text search) rather than loading the full collection into memory.
- **OTP-based password reset** — Email-delivered OTP via Nodemailer, with expiry and brute-force attempt limiting.
- **Automated test suite** — 90+ Jest/Supertest tests (unit + integration) covering auth, ownership/IDOR fixes, validation, RBAC, SLA logic, and attachment handling, using an in-memory MongoDB for CI-friendly testing.
- **Containerized** — Full stack (MongoDB + backend + frontend) runs with a single `docker-compose up`.
- **CI** — GitHub Actions runs the full backend test suite and a frontend production build on every push/PR.

## Tech Stack

**Frontend:** React, React Router, Bootstrap, Axios, Chart.js, React Toastify
**Backend:** Node.js, Express, MongoDB, Mongoose
**Auth & Security:** JWT, bcrypt, express-rate-limit, express-validator, helmet
**File Storage:** Cloudinary
**Testing:** Jest, Supertest, mongodb-memory-server
**Infra:** Docker, Docker Compose, GitHub Actions
**Email:** Nodemailer

## Project Structure

```
Complaint-Management-System/
├── README.md
├── docker-compose.yml
├── .env.example                    # Root env template (used by docker-compose)
├── .github/workflows/ci.yml        # CI: backend tests + frontend build
│
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── .env.example                # Backend env template
│   ├── app.js                      # Express app config (routes, middleware)
│   ├── server.js                   # DB connection + listen()
│   │
│   ├── config/
│   │   └── cloudinary.js           # Cloudinary config + upload helper
│   │
│   ├── middleware/
│   │   ├── auth.js                 # JWT verification, admin/staff role checks
│   │   ├── rateLimit.js            # Rate limiters (login, register, OTP)
│   │   ├── upload.js               # Multer config (memory storage, type/size limits)
│   │   └── validate.js             # express-validator rule sets
│   │
│   ├── models/
│   │   ├── User.js                 # User schema (auth, OTP, role enum)
│   │   ├── Complaint.js            # Complaint schema (history, attachments, assignedTo)
│   │   └── Counter.js              # Atomic counter for complaint IDs
│   │
│   ├── routes/
│   │   ├── auth.js                 # Register, login, OTP, password reset, user management
│   │   └── complaint.js            # Submit/view/update/assign/delete complaints, stats
│   │
│   ├── utils/
│   │   ├── sendEmail.js            # Nodemailer email helper
│   │   ├── complaintQuery.js       # Search/filter query builder
│   │   └── sla.js                  # SLA calculation logic
│   │
│   └── tests/                      # Jest test suites (unit + integration)
│
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── .dockerignore
    │
    └── src/
        ├── App.js                  # Route definitions
        ├── components/
        │   ├── Navbar.js
        │   ├── Footer.js
        │   └── ProtectedRoute.js
        └── pages/
            ├── Login.js / Register.js
            ├── ForgotPassword.js / VerifyOTP.js / ResetPassword.js
            ├── Dashboard.js            # Citizen dashboard
            ├── AddComplaint.js
            ├── ViewComplaints.js       # Shared list view (citizen/staff/admin, role-scoped)
            ├── AdminDashboard.js
            ├── ManageStaff.js          # Admin: promote/demote user roles
            ├── Profile.js / EditProfile.js / ChangePassword.js
```

## Getting Started

### Option A — Docker (recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
cp .env.example .env
# edit .env with real values (JWT_SECRET, EMAIL_USER/PASS, CLOUDINARY_*)
docker-compose up -d --build
```

This starts MongoDB, the backend API, and the frontend together:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`
- MongoDB: `localhost:27017` (local container, separate from any Atlas/cloud database)

Since this spins up a fresh, empty database, you'll need to register an account and then manually promote it to admin (see **Creating the first admin** below).

### Option B — Run locally without Docker

**Prerequisites:** Node.js, npm, a MongoDB connection (Atlas or local), a Gmail App Password, a Cloudinary account (free tier is fine).

```bash
cd backend
npm install
```

Create `backend/.env`:
```
MONGO_URI=your_mongodb_connection_string
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
JWT_SECRET=your_random_secret_string
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

```bash
node server.js
```

In a separate terminal:
```bash
cd frontend
npm install
npm start
```

### Creating the first admin

There's no public admin-signup endpoint (intentionally — anyone could self-promote otherwise). Register a normal account through the UI, then promote it directly in the database:

```js
// via mongosh (docker exec -it cms_mongo mongosh, or Atlas shell)
use complaint-management
db.users.updateOne(
  { email: "your@email.com" },
  { $set: { role: "admin" } }
)
```

Log out and back in afterward — the role is embedded in the JWT at login time, so a stale token won't reflect the promotion.

### Running tests

```bash
cd backend
npm test
```

Runs the full Jest/Supertest suite (90+ tests). Uses `mongodb-memory-server`, which downloads a MongoDB binary on first run — this requires internet access but works offline afterward (cached).

## Security Notes

- Passwords hashed with bcrypt; all sensitive routes require a valid JWT.
- Ownership checks on user-scoped data (a user can only read/edit their own profile, password, and complaints) — prevents IDOR (Insecure Direct Object Reference) vulnerabilities.
- Rate limiting on login, register, and OTP endpoints to slow brute-force/credential-stuffing attempts.
- Server-side input validation on every write endpoint — never trusts client-side validation alone.
- File uploads restricted by type (images + PDF) and size (5MB/file, 5 files max), validated server-side.
- `.env` files are excluded from version control — see `.env.example` for required variables.

## Author

Satya Mythri