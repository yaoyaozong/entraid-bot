# Migration Guide: Old to New Architecture

## Overview

This document shows how the original monolithic system was converted to a distributed HTTP-based architecture.

## Architecture Comparison

### Old System
```
┌─────────────────────────────────────────────────────────────┐
│                    Single Node.js Process                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   MCP Server (stdio)                  │  │
│  │  - Main: src/index.js                                 │  │
│  │  - Handles: ListTools, CallTool requests             │  │
│  │  - Manages: Tool execution, Azure auth               │  │
│  └───────────────────────────────────────────────────────┘  │
│           ▲                                ▲                 │
│           │ stdio pipe                     │ stdio pipe      │
│           ▼                                ▼                 │
│  ┌──────────────────┐            ┌──────────────────┐      │
│  │  Agent (CLI)     │            │  Web Server      │      │
│  │  agent.js        │            │  web-server.js   │      │
│  │  - Spawns MCP    │            │  - Embeds MCP    │      │
│  │  - Reads output  │            │  - Express API   │      │
│  │  - Calls tools   │            │  - Serves UI     │      │
│  └──────────────────┘            └──────────────────┘      │
└─────────────────────────────────────────────────────────────┘
         ▲                                ▲
         │ Process control                │ HTTP (3000)
         │                                │
    ┌────────────┐                  ┌──────────────┐
    │  Terminal  │                  │   Browser    │
    └────────────┘                  └──────────────┘
```

### New System
```
┌──────────────────────────────────────────────────────────────┐
│                     Three Independent Services               │
│                                                              │
│  ┌────────────────────────────┐                             │
│  │   MCP Server (HTTP)        │                             │
│  │   Port: 3001               │                             │
│  │  - Main: mcp-server/src/   │                             │
│  │  - Endpoints: /health      │                             │
│  │              /tools        │                             │
│  │              /call-tool    │                             │
│  │  - Handles: Azure auth     │                             │
│  │             Tool execution │                             │
│  └────┬───────────────────────┘                             │
│       │                                                      │
└───────┼──────────────────────────────────────────────────────┘
        │ HTTP REST API
        ├──────────────────────────┬──────────────────────────┐
        │                          │                          │
┌───────▼────────────────┐ ┌──────▼──────────────┐ ┌─────────▼────────┐
│   Agent (CLI)          │ │  Web Server        │ │ (Can be multiple)│
│   Port: stdin/stdout   │ │  Port: 3000        │ │                  │
│  - Main: agent/        │ │ - Main: web/       │ │ - Connect to MCP │
│  - OpenAI integration  │ │ - Express API      │ │ - Independent    │
│  - HTTP client to MCP  │ │ - Express static   │ │   scaling        │
│  - Readline interface  │ │ - HTTP client      │ │                  │
│                        │ │   to MCP           │ │                  │
└───────┬────────────────┘ └─────────┬──────────┘ └──────────────────┘
        │                            │
        │ Terminal input             │ Browser HTTP
        │                            │
    ┌───▼──────┐              ┌──────▼─────┐
    │ Terminal │              │  Browser   │
    └──────────┘              └────────────┘
```

## Code Migration Examples

### Example 1: Tool Definition

**Old (src/index.js):**
```javascript
const server = new Server({
  name: "entraId",
  version: "1.0.0",
}, {
  capabilities: {
    tools: {}
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [{
      name: "enable_user",
      description: "Enable a user...",
      inputSchema: { ... }
    }]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "enable_user") {
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result)
      }]
    };
  }
});

const transport = new StdioServerTransport();
server.connect(transport);
```

**New (mcp-server/src/index.js):**
```javascript
const tools = [
  {
    name: "enable_user",
    description: "Enable a user...",
    inputSchema: { ... }
  }
];

app.get("/tools", (req, res) => {
  res.json({ tools });
});

app.post("/call-tool", async (req, res) => {
  const { name, arguments: args } = req.body;
  
  if (name === "enable_user") {
    const result = await entraIdManager.enableUser(args.userId);
    res.json({ success: true, result });
  }
});

app.listen(PORT);
```

**Benefits:**
- ✅ Simpler HTTP REST pattern
- ✅ No MCP SDK boilerplate needed
- ✅ Easy to test with curl
- ✅ Stateless requests (no server state)

### Example 2: Agent/MCP Communication

**Old (agent.js):**
```javascript
// Spawn MCP server as subprocess
const server = spawn("node", ["src/index.js"], {
  stdio: [null, "pipe", "pipe"]
});

// Read JSON-RPC messages from server
server.stdout.on("data", (data) => {
  const message = JSON.parse(data);
  
  if (message.method === "tools/list_changed") {
    // Handle tool list change
  }
});

// Send JSON-RPC request
function callTool(name, args) {
  const request = {
    jsonrpc: "2.0",
    id: requestId++,
    method: "tools/call",
    params: { name, arguments: args }
  };
  
  server.stdin.write(JSON.stringify(request) + "\n");
}
```

**New (agent/index.js):**
```javascript
// Get tools from MCP server via HTTP
async function getAvailableTools() {
  const response = await axios.get(`${MCP_SERVER_URL}/tools`);
  return response.data.tools;
}

// Call tool via HTTP
async function callMCPTool(toolName, toolInput) {
  const response = await axios.post(`${MCP_SERVER_URL}/call-tool`, {
    name: toolName,
    arguments: toolInput
  });
  
  return response.data.result;
}
```

**Benefits:**
- ✅ No subprocess management needed
- ✅ Simple axios HTTP calls
- ✅ Easy error handling
- ✅ Can run on different machines

### Example 3: Web Server Integration

**Old (web-server.js):**
```javascript
// Embed MCP server in web server
const server = new Server({...});
server.setRequestHandler(ListToolsRequestSchema, ...);
server.setRequestHandler(CallToolRequestSchema, ...);

// Express middleware calls MCP directly
app.post("/api/chat", async (req, res) => {
  // Get tools from MCP (same process)
  const tools = getToolsFromMCP();
  
  // Send to OpenAI
  const response = openai.createMessage(...);
  
  // Call tool from MCP (same process)
  const result = callToolFromMCP(toolName);
  
  res.json({ response });
});
```

**New (web/server.js):**
```javascript
// Web server makes HTTP calls to separate MCP server
app.post("/api/chat", async (req, res) => {
  // Get tools from MCP via HTTP
  const toolsResponse = await axios.get(`${MCP_SERVER_URL}/tools`);
  const tools = toolsResponse.data.tools;
  
  // Send to OpenAI
  const response = await openai.chat.completions.create(...);
  
  // Call tool via HTTP
  const toolResponse = await axios.post(`${MCP_SERVER_URL}/call-tool`, {
    name: toolName,
    arguments: toolInput
  });
  
  res.json({ response });
});
```

**Benefits:**
- ✅ Web server and MCP server are decoupled
- ✅ Can scale web server separately
- ✅ MCP server updates don't affect web server
- ✅ Easy to add more web instances

## File Migration Map

| Old Location | New Location | Status |
|---|---|---|
| `src/index.js` | `mcp-server/src/index.js` | ✅ Migrated & Updated |
| `src/entraIdManager.js` | `mcp-server/src/entraIdManager.js` | ✅ Copied (no changes) |
| `agent.js` | `agent/index.js` | ✅ Migrated & Updated |
| `web-server.js` | `web/server.js` | ✅ Migrated & Updated |
| `public/` | `web/public/` | ✅ Copied (no changes) |
| `test-client.js` | - | 📋 Can be archived |

## Dependency Changes

### Old package.json
```json
{
  "dependencies": {
    "@azure/identity": "^4.0.1",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "axios": "^1.6.0",
    "express": "^4.18.2",
    "openai": "^4.28.0",
    "dotenv": "^16.3.1"
  }
}
```

### New Structure
**mcp-server/package.json** - MCP specific:
```json
{
  "dependencies": {
    "@azure/identity": "^4.0.1",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "axios": "^1.6.0",
    "express": "^4.18.2",
    "dotenv": "^16.3.1"
  }
}
```

**agent/package.json** - Agent specific:
```json
{
  "dependencies": {
    "openai": "^4.28.0",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1"
  }
}
```

**web/package.json** - Web specific:
```json
{
  "dependencies": {
    "openai": "^4.28.0",
    "axios": "^1.6.0",
    "express": "^4.18.2",
    "dotenv": "^16.3.1"
  }
}
```

**Benefits:**
- ✅ Each service has only required dependencies
- ✅ Smaller installation size per service
- ✅ Fewer security vulnerabilities to manage
- ✅ Easier to understand dependencies

## Configuration Changes

### Old (.env)
```
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
OPENAI_API_KEY=...
```

### New Structure
**mcp-server/.env:**
```
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
MCP_PORT=3001
```

**agent/.env:**
```
OPENAI_API_KEY=...
MCP_SERVER_URL=http://localhost:3001
```

**web/.env:**
```
OPENAI_API_KEY=...
MCP_SERVER_URL=http://localhost:3001
WEB_PORT=3000
```

**Benefits:**
- ✅ Each service has only its own config
- ✅ Services can be deployed independently
- ✅ Easy to point to different MCP servers
- ✅ Clear separation of concerns

## Startup Process

### Old
```bash
npm install
npm start    # Starts everything
```

Both agent and web server started if specified, all in one process.

### New
```bash
npm run install-all  # Install all components

# Terminal 1
cd mcp-server && npm start

# Terminal 2
cd agent && npm start

# Terminal 3
cd web && npm start
```

Each service runs independently with its own process.

## Performance Implications

### Old System
- **Pros**: Single process, no network overhead
- **Cons**: One crash brings down everything, limited scaling

### New System
- **Pros**: 
  - Individual service crashes don't affect others
  - Can scale each service independently
  - Easy to distribute across machines
  - Can run on containers (Docker)
- **Cons**: 
  - Small network overhead (HTTP calls)
  - Slightly more memory (3 processes vs 1)

**Trade-off**: Minimal performance cost for much better reliability and scalability.

## Testing

### Old System
```bash
node agent.js     # Just the agent
npm start         # Everything
```

Hard to test components independently.

### New System
```bash
# Test MCP server
curl http://localhost:3001/health
curl http://localhost:3001/tools
curl -X POST http://localhost:3001/call-tool ...

# Test web server
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/chat ...

# Test agent
cd agent && npm start
```

Each service can be tested independently with simple HTTP requests.

## Debugging

### Old System
- All logs in one terminal
- Harder to isolate issues
- Process crashes affect everything

### New System
- Each service in separate terminal
- Easy to see which service has issues
- Can restart one service without affecting others
- Independent log streams

## Deployment

### Old System
- Deploy monolithic executable
- Update entire system at once
- All-or-nothing scaling

### New System
- Deploy each service separately
- Can update one service without downtime
- Scale services independently
- Can run on multiple machines

## Rollback

### Old System
- Rollback entire application
- All users affected immediately

### New System
- Rollback individual service
- Can gradually migrate users
- Other services keep running

## Summary

| Aspect | Old | New |
|--------|-----|-----|
| Architecture | Monolithic | Microservices |
| Communication | stdio/pipes | HTTP REST |
| Scaling | Single process | Independent services |
| Testing | Integrated | Component-based |
| Deployment | All-or-nothing | Service-by-service |
| Debugging | Mixed logs | Separate logs |
| Reliability | Cascading failures | Isolated failures |
| Setup | Simple | Slightly complex |
| Maintenance | Simpler code | Better separation |

The new architecture trades minimal setup complexity for significantly better scalability, reliability, and maintainability.
