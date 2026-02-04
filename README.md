# LLMCouncil: Multi-Agent AI Assistant

A production-ready AI support triage system where multiple specialized agents (Vision, Technical, Empathy) analyze queries in parallel, and a Chairperson agent synthesizes their findings into a consensus verdict.

## Architecture

```
User Query + Image
      ↓
   Backend API (Express)
      ↓
┌─────────────────────────┐
│  Orchestration Engine   │
└─────────────────────────┘
      ↓
┌─────┬─────────┬─────────┐
│ Vision │ Tech │ Empathy │  ← Parallel Execution
│ GPT-4o │Claude│ Gemini  │
└─────┴─────────┴─────────┘
      ↓
┌─────────────────────────┐
│    Chairperson (GPT-4)  │  ← Synthesis
└─────────────────────────┘
      ↓
  Consensus Report
```

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (via Docker)
- API Keys: Google AI, OpenAI, Anthropic

### 1. Environment Setup

```bash
# Navigate to server directory
cd server

# Copy environment template
cp .env.local .env.local

# Edit .env.local and add your API keys:
# - GOOGLE_API_KEY
# - OPENAI_API_KEY
# - ANTHROPIC_API_KEY
# - JWT_SECRET (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

### 2. Database Setup (Docker)

```bash
# From project root
docker-compose up -d postgres

# Wait for database to be ready
docker-compose logs postgres

# The schema will be automatically initialized from server/src/db/schema.sql
```

### 3. Start Backend

**Option A: Docker (Recommended)**
```bash
docker-compose up
```

**Option B: Local Development**
```bash
cd server
npm install
npm run dev
```

Server will start on `http://localhost:3001`

### 4. Verify Installation

```bash
# Health check
curl http://localhost:3001/health

# Expected response:
# {"status":"ok","timestamp":"...","environment":"development"}
```

## API Endpoints

### Authentication

#### POST /auth/register
Register a new user.
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

Response:
```json
{
  "status": "success",
  "token": "jwt-token-here",
  "userId": "uuid"
}
```

#### POST /auth/login
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### Analysis

#### POST /api/analyze
Submit a query for council analysis.

Headers:
```
Authorization: Bearer {jwt-token}
Content-Type: multipart/form-data
```

Body:
```
query: "User cannot login to the application"
image: [file] (optional)
```

Response:
```json
{
  "status": "processing",
  "reportId": "uuid",
  "message": "Analysis started. Poll /api/results/{reportId} for updates."
}
```

#### GET /api/results/:reportId
Poll for analysis results.

Response (pending):
```json
{
  "status": "pending",
  "report": { ... }
}
```

Response (complete):
```json
{
  "status": "complete",
  "report": {
    "id": "uuid",
    "priority_score": 8,
    "root_cause": "...",
    "recommended_action": "...",
    "consensus_rate": 0.87,
    "agentOutputs": [...]
  }
}
```

### History

#### GET /api/history?limit=50&offset=0
Get analysis history.

#### GET /api/analytics
Get user analytics (total analyses, costs, etc).

## Project Structure

```
LLMCouncil/
├── server/                 # Backend (Node.js/Express)
│   ├── src/
│   │   ├── agents/        # AI Agent implementations
│   │   │   ├── vision.ts
│   │   │   ├── technical.ts
│   │   │   ├── empathy.ts
│   │   │   └── chairperson.ts
│   │   ├── services/
│   │   │   └── orchestration.ts
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── config/
│   │   ├── db/
│   │   │   └── schema.sql
│   │   └── index.ts
│   ├── .env.local         # Your API keys (DO NOT COMMIT)
│   ├── package.json
│   └── Dockerfile
├── llmcouncil_-ai-assistant-suite/  # Frontend (React)
│   ├── services/
│   │   └── api.ts
│   └── ...
├── docker-compose.yml
└── README.md
```

## Development

### Running Tests
```bash
cd server
npm test
```

### Database Migrations
```bash
# Manual schema update
psql -d llmcouncil -f server/src/db/schema.sql
```

### Debugging
```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f postgres
```

## Production Deployment

See `llmcouncil_prod_spec.md` for full production deployment guide.

Key considerations:
- Use environment-specific `.env` files
- Enable HTTPS
- Configure rate limiting
- Set up monitoring (Datadog/Sentry)
- Database backups
- Load testing (target: 1000 concurrent users)

## Security

- API keys are stored encrypted (AES-256)
- JWT authentication for all endpoints
- Rate limiting enabled (60 req/min by default)
- PII detection in input validation
- SQL injection protection via parameterized queries

## License

Proprietary - Internal Use Only

## Support

For issues or questions, refer to:
- `llmcouncil_prod_spec.md` - Full technical specification
- `PROJECT_STATUS_REPORT.md` - Current implementation status
- `walkthrough.md` - Latest verification results
