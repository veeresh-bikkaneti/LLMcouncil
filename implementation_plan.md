# Phase 1: Backend & Core Infrastructure (Implementation Plan)

**Goal:** Establish the production-ready Node.js/Express backend, connected to PostgreSQL, to replace the current client-side prototype logic.

## User Review Required
> [!IMPORTANT]
> This plan commits to a full rewrite of the orchestration logic. The current client-side `inferenceService.ts` will be deprecated in favor of the new backend.
>
> **Spec Alignment:** This plan strictly follows **Part 2 (Phase 1)** of `llmcouncil_prod_spec.md`.

## Proposed Changes

### 1. Server Initialization (New)
*   **Directory:** `server/`
*   **Files:**
    *   `src/index.ts`: Main Express app entry point.
    *   `src/config/database.ts`: PostgreSQL connection logic.
    *   `.env.example`: Template with all required keys (DB, API Keys, JWT Secrets).

### 2. Database Schema
*   **File:** `server/src/db/schema.sql`
*   **Action:** Create the exact schema defined in spec (Users, Sessions, ConsensusReports, AgentResponses, UsageMetrics).

### 3. Core Middleware
*   **Directory:** `server/src/middleware/`
*   **Files:**
    *   `auth.ts`: JWT verification.
    *   `errorHandler.ts`: Centralized error handling.
    *   `validation.ts`: Input validation using `express-validator`.

### 4. API Routes (Skeleton)
*   **Directory:** `server/src/routes/`
*   **Files:**
    *   `auth.ts`: Login/Register.
    *   `analysis.ts`: `POST /analyze` (File upload + Orchestration trigger).
    *   `history.ts`: Fetching past reports.

### 5. Frontend Integration
*   **Directory:** `llmcouncil_-ai-assistant-suite/`
*   **Action:** Update to use `api.ts` (new client) instead of direct calls.
    *   *Note: This will be tackled AFTER the backend server is running.*

## Verification Plan

### Automated Tests
1.  **Backend Health Check:**
    *   Run: `curl http://localhost:3001/health`
    *   Expect: `{"status":"ok", ...}`
2.  **Database Connection:**
    *   Run: `npm run migrate:init` (or manual psql execution)
    *   Verify: Tables `users`, `consensus_reports` exist.
3.  **Auth Flow:**
    *   Request: `POST /auth/register` with valid JSON.
    *   Expect: 200 OK + JWT Token.

### Manual Verification
1.  **Start Server:** `npm run dev` in `server/`.
2.  **Log Check:** Verify "Backend Started" and "Database connected" messages appear in terminal.
