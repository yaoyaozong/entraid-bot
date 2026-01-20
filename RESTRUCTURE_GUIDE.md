# EntraID Manager - Restructured Architecture

A distributed, HTTP-based system for managing Azure EntraID user accounts with AI assistance.

## Architecture Overview

The system is now split into three independent services that communicate via HTTP:

```
┌─────────────────┐
│   Web Browser   │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐         ┌──────────────────┐
│   Web Server    │◄────────►│   MCP Server     │
│  (Port 3000)    │ HTTP     │  (Port 3001)     │
└─────────────────┘         └──────┬───────────┘
                                   │ HTTPS
                            ┌──────▼─────────────┐
                            │  Microsoft Graph   │
                            │      API           │
                            └────────────────────┘

                    CLI Agent
                      │
              HTTP    │
                      ▼
┌──────────────────────────────────┐
│   MCP Server (Port 3001)         │
└────────────────────────────────────┘
```

### Components

#### 1. **MCP Server** (`/mcp-server`)
- **Role**: Exposes EntraID management tools via HTTP REST API
- **Port**: 3001 (configurable)
- **Endpoints**:
  - `GET /health` - Health check
  - `GET /tools` - List available tools
  - `POST /call-tool` - Execute a tool
- **Tools Available**:
  - `enable_user` - Enable a disabled user account
  - `disable_user` - Disable an active user account
  - `get_user_status` - Check user's current status

#### 2. **Agent** (`/agent`)
- **Role**: CLI interface for natural language interaction
- **Features**:
  - Connects to MCP Server via HTTP
  - Uses OpenAI GPT-4o-mini for understanding natural language
  - Executes tools via HTTP calls
  - Terminal-based conversation interface

#### 3. **Web Server** (`/web`)
- **Role**: HTTP server serving web-based UI
- **Port**: 3000 (configurable)
- **Features**:
  - Beautiful responsive chat interface
  - Connects to MCP Server via HTTP
  - Uses OpenAI for conversation understanding
  - Real-time message streaming
  - Conversation history management

## Quick Start

### Prerequisites
- Node.js 16+
- Azure EntraID application credentials
- OpenAI API key

### 1. Clone and Setup

```bash
# Navigate to project directory
cd /path/to/demo1_mcp_server

# Install dependencies for all components
npm run install-all

# Or install separately:
cd mcp-server && npm install && cd ..
cd agent && npm install && cd ..
cd web && npm install && cd ..
```

### 2. Configure Environment Variables

**MCP Server** (`mcp-server/.env`):
```
AZURE_TENANT_ID=your-azure-tenant-id
AZURE_CLIENT_ID=your-azure-client-id
AZURE_CLIENT_SECRET=your-azure-client-secret
MCP_PORT=3001
```

**Agent** (`agent/.env`):
```
OPENAI_API_KEY=your-openai-api-key
MCP_SERVER_URL=http://localhost:3001
```

**Web Server** (`web/.env`):
```
OPENAI_API_KEY=your-openai-api-key
MCP_SERVER_URL=http://localhost:3001
WEB_PORT=3000
```

### 3. Run All Components

**Option A: Run in separate terminals**

Terminal 1 - MCP Server:
```bash
cd mcp-server
npm start
# Server running on http://localhost:3001
```

Terminal 2 - Agent (CLI):
```bash
cd agent
npm start
# Waiting for input...
```

Terminal 3 - Web Server:
```bash
cd web
npm start
# Open http://localhost:3000 in your browser
```

**Option B: Run all at once** (requires `npm install -g concurrently`)
```bash
npm run start-all
```

## How It Works

### Chat Flow (Web UI)
1. User types message in browser → Web Server (`POST /api/chat`)
2. Web Server fetches available tools from MCP Server (`GET /tools`)
3. OpenAI receives user message + tools and decides which to use
4. Web Server calls MCP Server (`POST /call-tool`)
5. MCP Server executes tool via Azure Graph API
6. Response flows back through the chain to the browser

### Example Interaction
```
User: "Can you enable the user john.doe@example.com?"

Web Server:
  → Sends message to OpenAI with available tools
  → OpenAI determines: use "enable_user" with {userId: "john.doe@example.com"}
  → Calls MCP Server: POST /call-tool {name: "enable_user", arguments: {userId: "..."}}
  
MCP Server:
  → Authenticates with Azure
  → Makes PATCH request to Graph API
  → Returns result: {success: true, message: "User enabled"}
  
Web Server:
  → Receives result
  → Sends back to OpenAI for final response
  → Returns to browser: "I've successfully enabled the user john.doe@example.com"
```

## File Structure

```
demo1_mcp_server/
├── mcp-server/                 # MCP Server (HTTP endpoints)
│   ├── src/
│   │   ├── index.js           # HTTP server with endpoints
│   │   └── entraIdManager.js  # Azure Graph API integration
│   ├── package.json
│   ├── .env                   # Azure credentials
│   └── .env.example
├── agent/                      # CLI Agent
│   ├── index.js               # Agent that connects to MCP Server
│   ├── package.json
│   ├── .env                   # OpenAI + MCP Server URL
│   └── .env.example
├── web/                        # Web Server
│   ├── server.js              # Express server
│   ├── public/
│   │   ├── index.html         # Web UI
│   │   ├── script.js          # Frontend logic
│   │   └── style.css          # Styling
│   ├── package.json
│   ├── .env                   # OpenAI + MCP Server URL
│   └── .env.example
├── package.json               # Root (for running all components)
└── README.md
```

## Configuration Details

### Port Configuration
- **MCP Server**: Set `MCP_PORT` environment variable (default: 3001)
- **Web Server**: Set `WEB_PORT` environment variable (default: 3000)
- **Agent**: Connects to MCP Server URL via `MCP_SERVER_URL`

### Azure Configuration
All Azure credentials are configured in `mcp-server/.env`:
- `AZURE_TENANT_ID`: Your Azure directory ID
- `AZURE_CLIENT_ID`: Application client ID
- `AZURE_CLIENT_SECRET`: Application client secret

### OpenAI Configuration
- Set `OPENAI_API_KEY` in both `agent/.env` and `web/.env`
- Uses `gpt-4o-mini` model for cost efficiency

## Troubleshooting

### MCP Server Won't Start
```
Error: Cannot connect to Azure
→ Check AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
```

### Agent/Web Can't Connect to MCP Server
```
Error: MCP_SERVER_URL not accessible
→ Ensure MCP Server is running on port 3001
→ Check MCP_SERVER_URL in .env (should be http://localhost:3001)
```

### OpenAI API Errors
```
Error: Invalid API key
→ Check OPENAI_API_KEY in .env
→ Verify key is valid and has sufficient permissions
```

### User Not Found in Azure
```
Result: User not found
→ Verify user email address is correct
→ User must exist in your Azure EntraID directory
```

## Development & Testing

### Test MCP Server Directly
```bash
# Check health
curl http://localhost:3001/health

# Get available tools
curl http://localhost:3001/tools

# Call a tool
curl -X POST http://localhost:3001/call-tool \
  -H "Content-Type: application/json" \
  -d '{"name": "get_user_status", "arguments": {"userId": "user@example.com"}}'
```

### View MCP Server Logs
MCP Server logs all API calls and errors to console. Start with:
```bash
cd mcp-server && npm start
```

### Debug Agent Issues
Agent logs conversation flow and tool calls:
```bash
cd agent && npm start
# Look for [DEBUG] messages in output
```

## Advanced Configuration

### Using Different Azure Credentials per Component
Each component uses its own `.env` file, so you can:
- Run multiple instances on different ports
- Use different Azure credentials
- Connect agents to different MCP Servers

### Running MCP Server on Different Machine
1. Configure MCP Server on machine A
2. In agent/.env and web/.env, set:
   ```
   MCP_SERVER_URL=http://machine-a-ip:3001
   ```
3. Run agent/web on machine B

## API Documentation

### MCP Server Endpoints

#### GET /health
Returns server health status
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### GET /tools
Returns available tools with schemas
```json
{
  "tools": [
    {
      "name": "enable_user",
      "description": "Enable a disabled user account",
      "inputSchema": {
        "type": "object",
        "properties": {
          "userId": {"type": "string", "description": "User email"}
        }
      }
    }
  ]
}
```

#### POST /call-tool
Execute a tool
```json
{
  "name": "enable_user",
  "arguments": {
    "userId": "john.doe@example.com"
  }
}
```

### Web Server Endpoints

#### POST /api/chat
Send message to chat
```json
{
  "message": "Enable user john.doe@example.com",
  "conversationId": "optional-conversation-id"
}
```

Response:
```json
{
  "response": "I've enabled the user john.doe@example.com",
  "conversationId": "conv_timestamp"
}
```

## Security Notes

⚠️ **Important Security Considerations**:

1. **Never commit `.env` files** - They contain sensitive credentials
2. **Restrict API access** - The MCP Server should only be accessible from trusted agents
3. **Use HTTPS in production** - All HTTP communication should be encrypted
4. **Rotate credentials regularly** - Update Azure client secrets and OpenAI keys
5. **Audit logs** - Monitor MCP Server logs for unauthorized access attempts

## Support & Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Port already in use | Change port in .env or kill process using port |
| Azure authentication failed | Verify credentials in .env and Azure permissions |
| OpenAI rate limited | Wait a moment before retrying |
| MCP Server not responding | Check if running: `curl http://localhost:3001/health` |

### Getting Help

1. Check logs in the terminal where service is running
2. Verify all .env files are properly configured
3. Test each service independently before connecting

## Deployment

For production deployment, consider:
- Using environment variables instead of .env files
- Setting up Docker containers for each service
- Using reverse proxy (nginx) for HTTPS
- Implementing authentication for API endpoints
- Setting up monitoring and logging

## License

This project is part of UC Berkeley's Cyber295 Capstone.
