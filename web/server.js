import express from "express";
import OpenAI from "openai";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.WEB_PORT || 3000;

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "http://localhost:3001";

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Conversation history per session
const conversations = new Map();

// Get available tools
async function getAvailableTools() {
  try {
    const response = await axios.get(`${MCP_SERVER_URL}/tools`);
    return response.data.tools || [];
  } catch (error) {
    console.error("Could not retrieve tools:", error.message);
    return [];
  }
}

// Call tool via MCP server
async function callMCPTool(toolName, toolInput, requesterIp) {
  const response = await axios.post(`${MCP_SERVER_URL}/call-tool`, {
    name: toolName,
    arguments: toolInput,
    requesterIp: requesterIp || "web-server",
  });

  if (response.data.success) {
    return JSON.stringify(response.data.result);
  }

  throw new Error(response.data.error || "Unknown error");
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    mcpServer: MCP_SERVER_URL,
  });
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message, conversationId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Get or create conversation
    const convId = conversationId || `conv_${Date.now()}`;
    if (!conversations.has(convId)) {
      const systemPrompt = {
        role: "system",
        content: `You are an IT support assistant specialized in managing Microsoft Entra ID (formerly Azure Active Directory) user accounts.

Your responsibilities:
- Help users enable or disable user accounts in Entra ID
- Search for users by name, job title, or department
- Check user account status
- Provide clear, concise responses about account operations

Guidelines:
- When multiple users match a search, list them clearly and ask which one to act on
- Be professional and security-conscious
- If unsure about an operation, ask for clarification
- Explain what you're doing in simple terms

You have access to tools for managing Entra ID users. Use them appropriately to help users with their requests.`
      };
      conversations.set(convId, [systemPrompt]);
    }

    const messages = conversations.get(convId);

    // Add user message
    messages.push({
      role: "user",
      content: message,
    });

    // Get tools
    const tools = await getAvailableTools();
    const openaiTools = tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    // Call OpenAI
    let finalResponse = "";
    let loopCount = 0;
    const maxLoops = 5;

    while (loopCount < maxLoops) {
      loopCount++;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        tools: openaiTools,
        tool_choice: "auto",
      });

      const assistantMessage = {
        role: "assistant",
        content: response.choices?.[0]?.message?.content || "",
      };

      if (response.choices?.[0]?.message?.tool_calls) {
        assistantMessage.tool_calls = response.choices[0].message.tool_calls;
      }

      messages.push(assistantMessage);

      // Check for tool calls
      if (
        response.choices?.[0]?.message?.tool_calls &&
        response.choices[0].message.tool_calls.length > 0
      ) {
        const toolResults = [];

        for (const toolCall of response.choices[0].message.tool_calls) {
          const toolName = toolCall.function.name;
          let toolInput = {};

          try {
            toolInput = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            console.error(`Failed to parse arguments: ${e.message}`);
          }

          try {
            const result = await callMCPTool(toolName, toolInput, req.ip);
            toolResults.push({
              tool_call_id: toolCall.id,
              result: result,
            });
          } catch (error) {
            toolResults.push({
              tool_call_id: toolCall.id,
              result: `Error: ${error.message}`,
            });
          }
        }

        // Add tool results
        for (const toolCall of toolResults) {
          messages.push({
            role: "tool",
            tool_call_id: toolCall.tool_call_id,
            content: toolCall.result,
          });
        }
      } else {
        // No more tool calls
        finalResponse = response.choices?.[0]?.message?.content || "No response";
        break;
      }
    }

    res.json({
      response: finalResponse,
      conversationId: convId,
    });
  } catch (error) {
    console.error("Chat error:", error.message);
    res.status(500).json({
      error: error.message,
    });
  }
});

// Clear conversation
app.post("/api/clear", (req, res) => {
  const { conversationId } = req.body;
  if (conversationId) {
    conversations.delete(conversationId);
  }
  res.json({ status: "cleared" });
});

// Start server
app.listen(PORT, () => {
  console.log(`🌐 Web Server running at http://localhost:${PORT}`);
  console.log(`📡 MCP Server: ${MCP_SERVER_URL}`);
  console.log("");
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Web Server shutting down...");
  process.exit(0);
});
