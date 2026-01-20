# Quick Startup Guide - Restructured Architecture

## New Project Structure

Your project has been reorganized into **3 independent services** that communicate via **HTTP**:

```
mcp-server/   ← Azure EntraID tools (Port 3001)
agent/        ← CLI interface (connects to MCP Server)
web/          ← Web chat UI (Port 3000, connects to MCP Server)
```

## 5-Minute Setup

### Step 1: Copy Environment Files

```bash
# Copy environment templates and fill in your credentials
cp mcp-server/.env.example mcp-server/.env
cp agent/.env.example agent/.env
cp web/.env.example web/.env
```

Then edit each file with:
- **mcp-server/.env**: Azure credentials
- **agent/.env** & **web/.env**: OpenAI API key

### Step 2: Install Dependencies

```bash
# Install all at once
npm run install-all

# Or manually:
cd mcp-server && npm install && cd ..
cd agent && npm install && cd ..
cd web && npm install && cd ..
```

### Step 3: Start Services

**In 3 separate terminals:**

```bash
# Terminal 1: Start MCP Server
cd mcp-server && npm start

# Terminal 2: Start Agent (CLI)
cd agent && npm start

# Terminal 3: Start Web Server
cd web && npm start
# Open http://localhost:3000 in browser
```

## What Changed?

### Old Architecture
- Single `src/index.js` MCP server
- `agent.js` spawned subprocess
- `web-server.js` had built-in MCP server
- stdio communication (pipe-based)

### New Architecture ✨
- `mcp-server/src/index.js` - HTTP REST server
- `agent/index.js` - HTTP client connecting to MCP Server
- `web/server.js` - Express server with chat API
- All services communicate via **HTTP POST/GET**

## Running the Agent

```bash
npm run agent
```

The agent will start and ask for input. Try natural language requests:

### Example Conversations

**Check User Status:**
```
You: Is john@example.com enabled?
Agent: [checks status and responds]
```

**Disable User:**
```
You: Please disable the account for alice@example.com
Agent: [disables account and confirms]
```

**Enable User:**
```
You: Enable the account for bob@example.com
Agent: [enables account and confirms]
```

**Multiple Operations:**
```
You: Check the status of user@domain.com and then disable it if it's enabled
Agent: [checks status, sees it's enabled, disables it]
```

## How It Works

1. You send a natural language request
2. The agent parses your request using OpenAI's GPT model
3. OpenAI decides which tools to call (enable_user, disable_user, get_user_status)
4. The agent calls the appropriate tools via the MCP server
5. Results are processed and presented back to you

## Troubleshooting

**"Cannot connect to OpenAI"**
- Check your OPENAI_API_KEY in .env
- Verify you have API credits

**"Authentication failed with Azure"**
- Verify AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
- Ensure the app registration has User.ReadWrite.All permission

**"User not found"**
- Check the user ID or email format
- Verify the user exists in your Azure AD

## Testing

Test the MCP server without the agent:
```bash
npm start
```

Test basic functionality:
```bash
node test-client.js
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| AZURE_TENANT_ID | Azure AD tenant ID | Yes |
| AZURE_CLIENT_ID | Azure app registration ID | Yes |
| AZURE_CLIENT_SECRET | Azure app registration secret | Yes |
| OPENAI_API_KEY | OpenAI API key | Yes (for agent) |
