# Web UI Guide

## 🌐 Launch the Web Interface

```bash
npm run web
```

Then open your browser and navigate to:
```
http://localhost:3000
```

## Features

✅ **Interactive Chat Interface**
- Real-time chat with the EntraID Agent
- Beautiful, responsive design
- Message history in conversation
- Typing indicator while waiting for response

✅ **User Account Management**
- Check user account status (enabled/disabled)
- Enable disabled accounts
- Disable active accounts
- Natural language requests

✅ **Conversation Features**
- Clear chat history
- Status indicator (Ready, Processing, Error)
- Responsive design (works on mobile too)
- Auto-scroll to latest messages

✅ **REST API**
- `/api/chat` - Send chat message
- `/api/history` - Get conversation history
- `/api/clear` - Clear conversation
- `/api/health` - Health check

## Usage Examples

### In the Web UI

1. **Check User Status**
   ```
   User: Is john@example.com enabled?
   Agent: [Checks status and responds]
   ```

2. **Disable Account**
   ```
   User: Disable alice@company.com
   Agent: [Disables account and confirms]
   ```

3. **Enable Account**
   ```
   User: Enable bob@company.com
   Agent: [Enables account and confirms]
   ```

### Via API (cURL)

```bash
# Send a message
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Is user@example.com enabled?"}'

# Get conversation history
curl http://localhost:3000/api/history

# Clear conversation
curl -X POST http://localhost:3000/api/clear

# Health check
curl http://localhost:3000/api/health
```

## API Endpoints

### POST /api/chat
Send a message to the agent.

**Request:**
```json
{
  "message": "Check if user@example.com is enabled"
}
```

**Response:**
```json
{
  "response": "The user account is enabled.",
  "conversationId": 1234567890
}
```

### GET /api/history
Get the conversation history.

**Response:**
```json
{
  "history": [
    {
      "role": "user",
      "content": "Is user@example.com enabled?"
    },
    {
      "role": "assistant",
      "content": "The user account is enabled."
    }
  ]
}
```

### POST /api/clear
Clear the conversation history.

**Response:**
```json
{
  "status": "cleared"
}
```

### GET /api/health
Check if the server is running.

**Response:**
```json
{
  "status": "ok",
  "serverRunning": true
}
```

## Configuration

The web server runs on port `3000` by default. To change it, set the `PORT` environment variable:

```bash
PORT=8080 npm run web
```

## Features

- 🎨 Modern, responsive UI
- 💬 Real-time chat interface
- 🤖 AI-powered agent responses
- 📱 Mobile-friendly design
- 🔐 Works with real Azure credentials
- ⚡ Fast response times
- 🎯 Natural language understanding

## UI Components

### Chat Messages
- User messages appear on the right (blue)
- Agent messages appear on the left (purple)
- System messages appear centered (gray)

### Input Area
- Text input for messages
- Send button with keyboard shortcut (Enter)
- Help text with usage examples

### Status Indicator
- Shows current state (Ready, Processing, Error)
- Color-coded (green, blue, red)

### Clear Button
- Clear entire chat history
- Confirmation dialog to prevent accidents

## Troubleshooting

### Web page won't load
- Ensure the server is running: `npm run web`
- Check that port 3000 is available
- Try a different port: `PORT=8080 npm run web`

### Messages not sending
- Check that the MCP server started (look for "✅ MCP Server started")
- Verify OpenAI API key is set
- Check browser console for errors

### No response from agent
- Verify Azure credentials are correct
- Check MCP server logs in terminal
- Try a simpler request

## Architecture

```
Web Browser (index.html, style.css, script.js)
         ↓
Express Web Server (web-server.js)
         ↓
   OpenAI API
         ↓
   MCP Server (src/index.js)
         ↓
   EntraID Manager
         ↓
  Microsoft Graph API
         ↓
   Azure AD / EntraID
```

## Performance

- Response time: 2-5 seconds per request
- Handles multiple concurrent users
- Conversation history maintained in memory
- Auto-scrolling for better UX

Ready to chat? Open http://localhost:3000 in your browser! 🚀
