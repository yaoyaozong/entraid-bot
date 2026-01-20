# Quick Reference - Commands & Endpoints

## 🚀 Getting Started

### Installation
```bash
# Copy environment templates
cp mcp-server/.env.example mcp-server/.env
cp agent/.env.example agent/.env
cp web/.env.example web/.env

# Edit .env files with your credentials
# - mcp-server/.env: Azure credentials
# - agent/.env: OpenAI key
# - web/.env: OpenAI key

# Install all dependencies
npm run install-all

# Or install individually
cd mcp-server && npm install
cd ../agent && npm install
cd ../web && npm install
```

## 🎯 Running Services

### Option 1: Start Each Separately (Recommended for Development)

**Terminal 1 - MCP Server (Required)**
```bash
cd mcp-server
npm start
# Output: 🌐 MCP Server running at http://localhost:3001
```

**Terminal 2 - Agent (CLI Interface)**
```bash
cd agent
npm start
# Shows: "Agent ready. Type a command or question:"
# Type: "Enable john.doe@example.com"
```

**Terminal 3 - Web Server (Web UI)**
```bash
cd web
npm start
# Output: 🌐 Web Server running at http://localhost:3000
# Open http://localhost:3000 in browser
```

### Option 2: Start All at Once (Requires concurrently)

```bash
# Install concurrently globally
npm install -g concurrently

# Start all services
npm run start-all

# Or just install as dev dependency and use different approach
```

### Start Individual Services
```bash
npm run start-mcp     # Only MCP Server
npm run start-agent   # Only Agent
npm run start-web     # Only Web Server
```

## 🧪 Testing with curl

### MCP Server Endpoints

**Health Check**
```bash
curl http://localhost:3001/health
```
Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**List Available Tools**
```bash
curl http://localhost:3001/tools
```
Response:
```json
{
  "tools": [
    {
      "name": "enable_user",
      "description": "Enable a user account...",
      "inputSchema": {...}
    },
    {
      "name": "disable_user",
      "description": "Disable a user account...",
      "inputSchema": {...}
    },
    {
      "name": "get_user_status",
      "description": "Get user status...",
      "inputSchema": {...}
    }
  ]
}
```

**Get User Status**
```bash
curl -X POST http://localhost:3001/call-tool \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_user_status",
    "arguments": {
      "userId": "john.doe@example.com"
    }
  }'
```

**Enable User**
```bash
curl -X POST http://localhost:3001/call-tool \
  -H "Content-Type: application/json" \
  -d '{
    "name": "enable_user",
    "arguments": {
      "userId": "john.doe@example.com"
    }
  }'
```

**Disable User**
```bash
curl -X POST http://localhost:3001/call-tool \
  -H "Content-Type: application/json" \
  -d '{
    "name": "disable_user",
    "arguments": {
      "userId": "john.doe@example.com"
    }
  }'
```

### Web Server Endpoints

**Health Check**
```bash
curl http://localhost:3000/api/health
```

**Send Chat Message**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Can you check if john.doe@example.com is enabled?",
    "conversationId": "optional-conv-id"
  }'
```

**Clear Conversation**
```bash
curl -X POST http://localhost:3000/api/clear \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "conv-id-to-clear"
  }'
```

## 🔧 Configuration

### Environment Variables

**mcp-server/.env**
```env
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
MCP_PORT=3001
```

**agent/.env**
```env
OPENAI_API_KEY=your-openai-api-key
MCP_SERVER_URL=http://localhost:3001
```

**web/.env**
```env
OPENAI_API_KEY=your-openai-api-key
MCP_SERVER_URL=http://localhost:3001
WEB_PORT=3000
```

### Change Ports
- MCP Server: Edit `MCP_PORT` in `mcp-server/.env`
- Web Server: Edit `WEB_PORT` in `web/.env`
- Agent: Update `MCP_SERVER_URL` in `agent/.env` to match

### Connect to Remote Server
In `agent/.env` and `web/.env`:
```env
MCP_SERVER_URL=http://remote-machine-ip:3001
```

## 📝 NPM Scripts

### Root Level
```bash
npm run install-all      # Install all components
npm run start-all        # Start all services
npm run start-mcp        # Start only MCP Server
npm run start-agent      # Start only Agent
npm run start-web        # Start only Web Server
```

### mcp-server/
```bash
npm start                # Run MCP Server
npm run dev              # Run with auto-reload
```

### agent/
```bash
npm start                # Run Agent
```

### web/
```bash
npm start                # Run Web Server
```

## 🐛 Troubleshooting Commands

### Check if ports are in use
```bash
# macOS/Linux
lsof -i :3001           # Check MCP port
lsof -i :3000           # Check Web port

# Windows
netstat -ano | findstr :3001
netstat -ano | findstr :3000
```

### Kill process on port
```bash
# macOS/Linux
kill -9 $(lsof -t -i :3001)
kill -9 $(lsof -t -i :3000)

# Windows
taskkill /PID <PID> /F
```

### Test Azure Credentials
```bash
# In mcp-server/.env, verify:
# AZURE_TENANT_ID=<your-tenant>
# AZURE_CLIENT_ID=<your-client>
# AZURE_CLIENT_SECRET=<your-secret>

# Then test with curl:
curl -X POST http://localhost:3001/call-tool \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_user_status",
    "arguments": {"userId": "test@yourdomain.com"}
  }'
```

### Test OpenAI Key
Agent or Web will show error if OPENAI_API_KEY is invalid. Check:
```bash
# In agent/.env and web/.env
OPENAI_API_KEY=sk-...
```

### View Service Logs
Each service runs in its own terminal and shows logs directly.

**MCP Server logs:**
- Startup messages
- API requests to Azure
- Tool call results

**Agent logs:**
- Tool names being called
- Tool inputs/outputs
- OpenAI responses

**Web Server logs:**
- Express request logs
- Chat API calls
- OpenAI responses

## 📊 Testing Checklist

- [ ] MCP Server starts: `curl http://localhost:3001/health`
- [ ] Tools available: `curl http://localhost:3001/tools`
- [ ] Can get user status: `curl -X POST http://localhost:3001/call-tool ...`
- [ ] Agent starts and connects to MCP
- [ ] Agent can understand natural language
- [ ] Agent can call tools
- [ ] Web Server starts: `curl http://localhost:3000/api/health`
- [ ] Web UI loads at http://localhost:3000
- [ ] Web UI can send messages
- [ ] Web UI shows tool results

## 🚀 Performance Tips

### For Development
- Keep services running in separate terminals
- Watch for logs in each terminal
- Use curl to test individual endpoints

### For Deployment
- Use process managers (PM2, systemd, Docker)
- Set up reverse proxy (nginx) with HTTPS
- Configure monitoring and alerting
- Use environment variables (not .env files)

## 📚 Documentation Files

- **RESTRUCTURE_GUIDE.md** - Complete technical documentation
- **QUICKSTART.md** - 5-minute setup guide
- **MIGRATION_GUIDE.md** - Old vs new architecture
- **RESTRUCTURE_COMPLETE.md** - What was changed
- **README.md** - Original project readme
- **WEB_UI_GUIDE.md** - Web UI features

## 🔐 Security Reminders

⚠️ Never commit `.env` files - they contain secrets!

```bash
# .gitignore should include:
.env
.env.*.local
node_modules/
```

## 📱 Accessing Web UI

- **Local**: http://localhost:3000
- **Remote**: http://your-server-ip:3000
- Change `WEB_PORT` in web/.env for different port

## 💡 Common Workflows

### Disable a User
**Via CLI:**
```
Agent: > Disable jane.smith@example.com
Agent responds with Azure result
```

**Via Web:**
```
1. Open http://localhost:3000
2. Type: "Disable jane.smith@example.com"
3. Chat shows result
```

**Via curl:**
```bash
curl -X POST http://localhost:3001/call-tool \
  -H "Content-Type: application/json" \
  -d '{
    "name": "disable_user",
    "arguments": {"userId": "jane.smith@example.com"}
  }'
```

### Check User Status
**Via CLI:**
```
Agent: > What's the status of john@example.com?
```

**Via Web:**
```
Chat: "Is john@example.com enabled?"
```

**Via curl:**
```bash
curl -X POST http://localhost:3001/call-tool \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_user_status",
    "arguments": {"userId": "john@example.com"}
  }'
```

## 📞 Support

For issues:
1. Check service logs (each in separate terminal)
2. Verify .env files are configured
3. Test with curl commands above
4. Check documentation files
5. Ensure MCP Server is running first

## 🚀 Start Here

### 1. Web UI (Recommended)
```bash
npm run web
# Then open: http://localhost:3000
```

### 2. CLI Agent
```bash
npm run agent
# Type your requests in terminal
```

### 3. API Only
```bash
npm run web
# Use curl or Postman to send requests
```

## 💬 Example Requests

| Request | Result |
|---------|--------|
| "Is john@example.com enabled?" | Checks account status |
| "Disable alice@company.com" | Disables the account |
| "Enable bob@example.com" | Enables the account |
| "Check user@domain.com" | Gets user details |

## 🔧 Configuration Checklist

```
✅ .env file created
  AZURE_TENANT_ID=...
  AZURE_CLIENT_ID=...
  AZURE_CLIENT_SECRET=...
  OPENAI_API_KEY=...

✅ npm install completed
✅ Dependencies installed
✅ Azure app has User.ReadWrite.All permission
✅ OpenAI account has API credits
```

## 📍 Access Points

| Interface | URL | Command |
|-----------|-----|---------|
| Web UI | http://localhost:3000 | `npm run web` |
| CLI | Terminal | `npm run agent` |
| API | http://localhost:3000/api/chat | `npm run web` |
| MCP Server | stdio | `npm start` |

## 🔌 API Endpoints

```bash
# Send message
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Is user@example.com enabled?"}'

# Get history
curl http://localhost:3000/api/history

# Clear chat
curl -X POST http://localhost:3000/api/clear

# Health check
curl http://localhost:3000/api/health
```

## 📁 Important Files

| File | Purpose |
|------|---------|
| `.env` | Your credentials |
| `src/index.js` | MCP server |
| `agent.js` | CLI agent |
| `web-server.js` | Web server |
| `public/` | Web UI |

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Enter | Send message (web UI) |
| Shift+Enter | New line (web UI) |
| Ctrl+C | Exit agent |
| Ctrl+C | Stop server |

## 🎯 Common Tasks

### Check User Status
```
Web UI: "Is user@example.com enabled?"
CLI: "Is user@example.com enabled?"
API: POST {"message":"Is user@example.com enabled?"}
```

### Disable Account
```
Web UI: "Disable user@example.com"
CLI: "Disable user@example.com"
API: POST {"message":"Disable user@example.com"}
```

### Enable Account
```
Web UI: "Enable user@example.com"
CLI: "Enable user@example.com"
API: POST {"message":"Enable user@example.com"}
```

## 🐛 Quick Fixes

### Port already in use
```bash
PORT=8080 npm run web
```

### Clear conversation
```bash
# Web UI: Click "Clear Chat" button
# API: curl -X POST http://localhost:3000/api/clear
```

### View real-time logs
```bash
# Terminal shows all MCP server logs
# Check for [Server] prefix messages
```

## 📊 Status Indicators

| Status | Meaning |
|--------|---------|
| ✅ Ready | System ready for input |
| ⏳ Processing | Agent thinking/calling tools |
| ❌ Error | Something went wrong |
| 🤖 Ready | MCP server started |

## 🔐 Security Reminders

- ✅ Never commit `.env` file
- ✅ Never share API keys
- ✅ Rotate credentials regularly
- ✅ Use minimal permissions
- ✅ Monitor API usage

## 📚 Learn More

- Full docs: [README.md](README.md)
- Web UI guide: [WEB_UI_GUIDE.md](WEB_UI_GUIDE.md)
- System overview: [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md)
- Quick start: [QUICKSTART.md](QUICKSTART.md)

## 🎯 Performance Tips

- Web UI is fastest for end users
- CLI agent good for development
- API best for automation
- Keep conversation history under 50 messages for best performance

---

**All set?** Run `npm run web` and open http://localhost:3000! 🎉
