# EntraID MCP Server

A Model Context Protocol (MCP) server written in Node.js for enabling/disabling user accounts in Microsoft Entra ID (Azure AD), with an intelligent agent powered by OpenAI.

## Features

### MCP Server
- **Enable User Account**: Enable a disabled user account in EntraID
- **Disable User Account**: Disable an active user account in EntraID
- **Get User Status**: Check the current account status (enabled/disabled) of a user

### Agent
- Interactive conversational interface powered by OpenAI's GPT models
- Automatically calls appropriate tools based on natural language requests
- Handles multi-turn conversations with tool calling

## Prerequisites

Before running the server and agent, you need to set up credentials:

### 1. Azure App Registration
Create an app registration in your Azure tenant with:
- **Permissions**: `User.ReadWrite.All` - to read and write user account properties
- **Credentials**: Tenant ID, Client ID, and Client Secret

### 2. OpenAI API Key
Get an API key from [OpenAI](https://platform.openai.com/api-keys)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the project root:
```
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
OPENAI_API_KEY=your-openai-api-key
```

## Usage

### Start Only the MCP Server
```bash
npm start
```

The server listens on stdio for MCP protocol requests.

### Run the Interactive Command-Line Agent
```bash
npm run agent
```

This starts both the MCP server and an interactive agent. You can then have conversations like:

```
You: Check if john@example.com is enabled
Agent: I'll check the status of that user...
[calls get_user_status tool]
Agent: John's account is currently enabled.

You: Disable the account for john@example.com
Agent: I'll disable that account for you...
[calls disable_user tool]
Agent: John's account has been successfully disabled.
```

### 🌐 Launch the Web UI (Recommended)
```bash
npm run web
```

Then open your browser to:
```
http://localhost:3000
```

The web interface provides:
- 💬 Modern chat interface
- 📱 Responsive design (works on mobile)
- ✨ Real-time typing indicators
- 📋 Conversation history
- 🎯 Easy natural language queries

**Example web UI interactions:**
```
User: Is alice@example.com enabled?
[Agent checks and responds]
Agent: Yes, alice's account is currently enabled.

User: Disable that account
[Agent disables it]
Agent: Alice's account has been successfully disabled.
```

See [WEB_UI_GUIDE.md](WEB_UI_GUIDE.md) for detailed web UI documentation.

## Architecture

### Files
- **src/index.js** - Main MCP server entry point that defines tools and handles requests
- **src/entraIdManager.js** - Handles authentication and Microsoft Graph API interactions
- **agent.js** - Intelligent CLI agent that connects to OpenAI and orchestrates tool calls
- **web-server.js** - Express web server for the chat UI
- **public/index.html** - Web UI (chat interface)
- **public/style.css** - Web UI styling
- **public/script.js** - Web UI client-side logic
- **test-client.js** - Test client for basic MCP server verification

### How It Works

```
User Input
    ↓
Agent (agent.js)
    ↓
OpenAI API (decides which tool to call)
    ↓
MCP Server (src/index.js)
    ↓
EntraID Manager (src/entraIdManager.js)
    ↓
Microsoft Graph API
    ↓
Azure AD / EntraID
```

## Available Tools

### 1. `enable_user`
Enable a user account in EntraID.

**Parameters:**
- `userId` (required): User ID (GUID) or User Principal Name (UPN/email)

**Example:**
```json
{
  "name": "enable_user",
  "arguments": {
    "userId": "user@example.com"
  }
}
```

### 2. `disable_user`
Disable a user account in EntraID.

**Parameters:**
- `userId` (required): User ID (GUID) or User Principal Name (UPN/email)

**Example:**
```json
{
  "name": "disable_user",
  "arguments": {
    "userId": "user@example.com"
  }
}
```

### 3. `get_user_status`
Get the current account status of a user.

**Parameters:**
- `userId` (required): User ID (GUID) or User Principal Name (UPN/email)

**Example:**
```json
{
  "name": "get_user_status",
  "arguments": {
    "userId": "user@example.com"
  }
}
```

## API Details

### Microsoft Graph API
This server uses the Microsoft Graph API to manage user accounts. The following endpoints are used:

- `PATCH /users/{id}` - Update user properties (accountEnabled)
- `GET /users/{id}` - Retrieve user properties

For more information, see the [Microsoft Graph API documentation](https://docs.microsoft.com/en-us/graph/api/overview).

## Error Handling

The system includes comprehensive error handling for:
- Missing or invalid credentials
- Invalid user IDs
- API authentication failures
- Network errors
- Tool invocation errors

## Security Considerations

- Store credentials securely using environment variables
- Never commit `.env` file to version control
- Use the principle of least privilege for app registration permissions
- Consider using Azure Managed Identity in production environments
- Keep OpenAI API key secure and rotate regularly

## Troubleshooting

### "Cannot find module @azure/identity"
```bash
npm install
```

### "OPENAI_API_KEY is undefined"
Ensure you have set `OPENAI_API_KEY` in your `.env` file.

### "Authentication failed"
Verify your Azure credentials (Tenant ID, Client ID, Client Secret) are correct and have proper permissions.

### Agent doesn't respond to tool calls
Ensure the MCP server is running correctly and the tools are available.

## License

MIT
