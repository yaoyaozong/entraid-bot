import express from "express";
import dotenv from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { EntraIDManager } from "./entraIdManager.js";

dotenv.config();

const app = express();
const PORT = process.env.MCP_PORT || 3001;

app.use(express.json());

// Initialize Entra ID Manager
const entraIdManager = new EntraIDManager({
  tenantId: process.env.AZURE_TENANT_ID,
  clientId: process.env.AZURE_CLIENT_ID,
  clientSecret: process.env.AZURE_CLIENT_SECRET,
});

// Define tools
const tools = [
  {
    name: "enable_user",
    description:
      "Enable a user account in EntraID by user ID or user principal name (UPN)",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description:
            "User ID (GUID) or User Principal Name (UPN/email) of the user to enable",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "disable_user",
    description:
      "Disable a user account in EntraID by user ID or user principal name (UPN). Guest users (containing #EXT# in their UPN) cannot be disabled.",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description:
            "User ID (GUID) or User Principal Name (UPN/email) of the user to disable",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "get_user_status",
    description: "Get the account enabled/disabled status of a user in EntraID",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "User ID (GUID) or User Principal Name (UPN/email)",
        },
      },
      required: ["userId"],
    },
  },
];

// API Endpoints

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Get available tools
app.get("/tools", (req, res) => {
  res.json({
    tools: tools,
  });
});

// Call a tool
app.post("/call-tool", async (req, res) => {
  try {
    const { name, arguments: args } = req.body;

    if (!name || !args) {
      return res.status(400).json({
        error: "name and arguments are required",
      });
    }

    let result;

    switch (name) {
      case "enable_user":
        result = await entraIdManager.enableUser(args.userId);
        break;
      case "disable_user":
        result = await entraIdManager.disableUser(args.userId);
        break;
      case "get_user_status":
        result = await entraIdManager.getUserStatus(args.userId);
        break;
      default:
        return res.status(400).json({
          error: `Unknown tool: ${name}`,
        });
    }

    res.json({
      success: true,
      result: result,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Start HTTP server
app.listen(PORT, () => {
  console.log(
    `✅ MCP Server running at http://localhost:${PORT}`
  );
  console.log(`📋 Available endpoints:`);
  console.log(`   - GET  http://localhost:${PORT}/health      (Health check)`);
  console.log(`   - GET  http://localhost:${PORT}/tools       (List tools)`);
  console.log(`   - POST http://localhost:${PORT}/call-tool   (Call tool)`);
  console.log(``);
  console.log(`Environment: MCP_PORT=${PORT}`);
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 MCP Server shutting down...");
  process.exit(0);
});
