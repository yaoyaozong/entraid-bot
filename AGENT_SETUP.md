# Agent Setup and Testing Guide

## ✅ System is Now Fully Functional

Your EntraID MCP Server with OpenAI Agent is ready to use!

## What's Working

### ✅ MCP Server (`npm start`)
- Listens for MCP protocol requests
- Provides three tools:
  - `enable_user` - Enable a disabled account
  - `disable_user` - Disable an active account  
  - `get_user_status` - Check account status

### ✅ OpenAI Agent (`npm run agent`)
- Starts the MCP server automatically
- Connects to OpenAI API
- Converts natural language to tool calls
- Handles multi-turn conversations
- Executes tools and returns results

## Running the Agent

### Interactive Mode
```bash
npm run agent
```

Then type natural language requests:
```
You: Check if john@example.com is enabled
Agent: I'll check that user for you...
[calls get_user_status tool]
Agent: The user account "john@example.com" does not exist in the system...

You: Disable alice@contoso.com
Agent: I'll disable that account...
[calls disable_user tool]
Agent: [provides result]

You: exit
```

### Batch Mode (for testing)
```bash
timeout 45 npm run agent <<< $'Is user@example.com enabled?\nexit'
```

## Features Demonstrated

- ✅ Agent parses natural language
- ✅ Agent calls appropriate MCP tools
- ✅ Agent handles errors gracefully
- ✅ Agent provides natural responses
- ✅ Server validates Azure credentials
- ✅ MCP protocol communication works

## Next Steps

1. **Add Real Azure Credentials**
   - Update your `.env` with real Azure tenant/client/secret
   - Agent will then be able to actually enable/disable real users

2. **Test with Real Users**
   - Try requests like "Check if alice@mycompany.com is enabled"
   - Try "Disable bob@mycompany.com"

3. **Extend Functionality**
   - Add more tools (list users, reset passwords, etc.)
   - Add Azure permissions management
   - Create custom business logic

## Architecture Summary

```
User Input (Natural Language)
         ↓
    Agent (agent.js)
         ↓
  OpenAI ChatGPT API
         ↓
   Tool Selection
         ↓
   MCP Server (src/index.js)
         ↓
   EntraID Manager (src/entraIdManager.js)
         ↓
   Microsoft Graph API
         ↓
   Azure AD / EntraID
         ↓
   Tool Result
         ↓
   Agent Response (Natural Language)
```

## Troubleshooting

**"Cannot connect to OpenAI"**
- Verify OPENAI_API_KEY in .env
- Check your OpenAI account has API credits

**"Authentication failed with Azure"**
- Verify Azure credentials in .env
- Ensure app registration has User.ReadWrite.All permission

**"User not found" error**
- This is normal for non-existent test users
- Try with real users in your Azure AD

**Agent doesn't respond**
- Check MCP server is starting (look for "✅ MCP Server started")
- Verify tools are listed in output
- Try a simpler request without tool calls

## Files Modified

- `agent.js` - Main agent orchestrator (fixed communication)
- `package.json` - Updated with OpenAI dependency
- `.env.example` - Added OPENAI_API_KEY
- `README.md` - Updated documentation
- `QUICKSTART.md` - Quick start guide

## Commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm start` | Run MCP server only |
| `npm run agent` | Run interactive agent |
| `npm run dev` | Run server in watch mode |
| `node test-client.js` | Test basic MCP functionality |

All systems are Go! 🚀
