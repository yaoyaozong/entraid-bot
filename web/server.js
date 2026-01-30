import express from "express";
import OpenAI from "openai";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import * as msal from "@azure/msal-node";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.WEB_PORT || 3000;

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "http://localhost:3001";

// MSAL Configuration
const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel, message, containsPii) {
        if (process.env.DEBUG === 'true') {
          console.log(message);
        }
      },
      piiLoggingEnabled: false,
      logLevel: msal.LogLevel.Warning,
    },
  },
};

const msalInstance = new msal.ConfidentialClientApplication(msalConfig);

// Helper function to get dynamic redirect URI based on request
function getRedirectUri(req) {
  // If REDIRECT_URI is explicitly set in env, use it
  if (process.env.REDIRECT_URI) {
    return process.env.REDIRECT_URI;
  }
  
  // Otherwise, dynamically construct based on the request
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}/auth/callback`;
}

// Helper function to get dynamic post-logout redirect URI
function getPostLogoutRedirectUri(req) {
  // If POST_LOGOUT_REDIRECT_URI is explicitly set in env, use it
  if (process.env.POST_LOGOUT_REDIRECT_URI) {
    return process.env.POST_LOGOUT_REDIRECT_URI;
  }
  
  // Otherwise, dynamically construct based on the request
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}`;
}

// Redirect URIs (fallback for non-request contexts)
const REDIRECT_URI = process.env.REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;
const POST_LOGOUT_REDIRECT_URI = process.env.POST_LOGOUT_REDIRECT_URI || `http://localhost:${PORT}`;

// Trust proxy - important when deployed behind load balancers/reverse proxies
app.set('trust proxy', true);

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to get real client IP (handles proxies)
function getClientIp(req) {
  // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
  // The first one is the original client
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    return ips[0];
  }
  
  // Fallback to other common headers
  return req.headers['x-real-ip'] || 
         req.headers['x-client-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
}

// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.session && req.session.account) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated', requiresAuth: true });
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Debug middleware - log all HTTP requests
app.use((req, res, next) => {
  if (process.env.DEBUG === 'true') {
    const clientIp = getClientIp(req);
    console.log("\n========== HTTP REQUEST DEBUG ==========");
    console.log(`${req.method} ${req.url}`);
    console.log("Timestamp:", new Date().toISOString());
    console.log("Client IP:", clientIp);
    console.log("req.ip (Express):", req.ip);
    console.log("\nHeaders:");
    console.log(JSON.stringify(req.headers, null, 2));
    console.log("\nBody:");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("========================================\n");
  }
  next();
});

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
async function callMCPTool(toolName, toolInput, requesterIp, authenticatedUser) {
  const response = await axios.post(`${MCP_SERVER_URL}/call-tool`, {
    name: toolName,
    arguments: toolInput,
    requesterIp: requesterIp || "web-server",
    authenticatedUser: authenticatedUser || "unknown",
  });

  if (response.data.success) {
    return JSON.stringify(response.data.result);
  }

  throw new Error(response.data.error || "Unknown error");
}

// Authentication routes
app.get("/auth/signin", async (req, res) => {
  const redirectUri = getRedirectUri(req);
  const authCodeUrlParameters = {
    scopes: ["user.read"],
    redirectUri: redirectUri,
  };

  try {
    const authCodeUrl = await msalInstance.getAuthCodeUrl(authCodeUrlParameters);
    console.log(`OAuth2 signin initiated with redirect URI: ${redirectUri}`);
    res.redirect(authCodeUrl);
  } catch (error) {
    console.error("Error generating auth URL:", error);
    res.status(500).send("Authentication error");
  }
});

app.get("/auth/callback", async (req, res) => {
  const redirectUri = getRedirectUri(req);
  const tokenRequest = {
    code: req.query.code,
    scopes: ["user.read"],
    redirectUri: redirectUri,
  };

  try {
    const response = await msalInstance.acquireTokenByCode(tokenRequest);
    req.session.account = response.account;
    req.session.accessToken = response.accessToken;
    console.log(`OAuth2 callback successful for user: ${response.account.username}`);
    res.redirect("/");
  } catch (error) {
    console.error("Error acquiring token:", error);
    res.status(500).send("Authentication error");
  }
});

app.get("/auth/signout", (req, res) => {
  const account = req.session.account;
  const postLogoutRedirectUri = getPostLogoutRedirectUri(req);
  
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
    }
    
    const logoutUri = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirectUri)}`;
    console.log(`User signed out, redirecting to: ${postLogoutRedirectUri}`);
    res.redirect(logoutUri);
  });
});

app.get("/api/user", isAuthenticated, (req, res) => {
  res.json({
    user: {
      name: req.session.account.name,
      username: req.session.account.username,
    },
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    mcpServer: MCP_SERVER_URL,
    authenticated: !!req.session?.account,
  });
});

// Chat endpoint
app.post("/api/chat", isAuthenticated, async (req, res) => {
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
            const result = await callMCPTool(
              toolName, 
              toolInput, 
              getClientIp(req),
              req.session?.account?.username || req.session?.account?.name || "unknown"
            );
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
app.post("/api/clear", isAuthenticated, (req, res) => {
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
