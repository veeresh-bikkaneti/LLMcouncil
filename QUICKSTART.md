# LLMCouncil: Quick Start & Testing Guide

## Step 1: Configure API Keys (2 minutes)

Edit `server/.env.local` and replace these values:

```bash
# Use these generated secrets:
JWT_SECRET=56eea525036b57de81c48939006a0236b3632166b75c2068989e685d24a4649a
JWT_REFRESH_SECRET=69bfe6f1d1366cc20b3632166b75c2068989e685d
AES_ENCRYPTION_KEY=d3c26aa5338bbadf2ca9ea41b3632166b75c2068989e685d

# Add your AI provider API keys:
GOOGLE_API_KEY=<your-key-from-https://aistudio.google.com/app/apikey>
OPENAI_API_KEY=<your-key-from-https://platform.openai.com/api-keys>
ANTHROPIC_API_KEY=<your-key-from-https://console.anthropic.com>
```

## Step 2: Start Database (1 minute)

```bash
# From project root
docker-compose up -d postgres

# Verify it's running
docker-compose ps
```

Expected output:
```
NAME                  STATUS
llmcouncil_db         Up (healthy)
```

## Step 3: Start Backend Server (1 minute)

```bash
cd server
npm run dev
```

Expected output:
```
╔════════════════════════════════════════╗
║   LLMCouncil Backend Started           ║
║   🚀 Running on http://localhost:3001  ║
║   📊 Environment: development          ║
╚════════════════════════════════════════╝
✅ Database connected
```

## Step 4: Run API Tests (30 seconds)

Open a **new terminal** and run:

```bash
cd server
node test-api.js
```

This will:
1. ✅ Check health endpoint
2. ✅ Register a test user
3. ✅ Submit an analysis
4. ⏱️ Poll for results (may take 15-30 seconds)
5. ✅ Check history

## Step 5: Manual Test (Optional)

### Test Health Check
```bash
curl http://localhost:3001/health
```

### Register a User
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"SecurePass123"}'
```

### Submit Analysis
```bash
curl -X POST http://localhost:3001/api/analyze \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "query=User cannot login, getting error 500"
```

### Check Results
```bash
curl http://localhost:3001/api/results/REPORT_ID_HERE
```

## Troubleshooting

### Database Connection Failed
```bash
# Check database is running
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

### Server Won't Start
```bash
# Check port 3001 is available
netstat -ano | findstr :3001

# Kill process if needed
taskkill /PID <process_id> /F
```

### API Keys Invalid
- Verify keys are correctly copied (no extra spaces)
- Check key validity at provider dashboards
- Ensure `.env.local` is in the `server/` directory

## Next Steps

Once backend tests pass:
1. Connect frontend React app to backend
2. Test full user flow through UI
3. Deploy to production environment

## What's Running?

- Backend API: http://localhost:3001
- Database: localhost:5432
- Frontend (if started): http://localhost:3000

## Stopping Everything

```bash
# Stop backend: Ctrl+C in terminal

# Stop database
docker-compose down

# Keep database data but stop containers
docker-compose stop
```
