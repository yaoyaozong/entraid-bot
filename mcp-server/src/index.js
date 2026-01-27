import express from "express";
import dotenv from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { EntraIDManager } from "./entraIdManager.js";
import { ImmuDBLogger } from "./immudbLogger.js";

dotenv.config();

const app = express();
const PORT = process.env.MCP_PORT || 3001;

app.use(express.json());

// Resolve requester IPs even when behind proxies or when the agent forwards it explicitly.
const getRequesterIp = req => {
  // Highest priority: agent-provided explicit IP (body or custom header)
  const explicitIp = req.body?.requesterIp || req.headers["x-user-ip"];
  if (typeof explicitIp === "string" && explicitIp.trim()) {
    return explicitIp.trim();
  }

  // Proxy headers (standard): X-Forwarded-For, X-Real-IP
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    const forwardedIps = forwarded.split(",").map(ip => ip.trim());
    if (forwardedIps[0]) {
      return forwardedIps[0];
    }
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }

  // Fallback: connection-derived
  return req.socket?.remoteAddress || req.ip || "unknown";
};

// Initialize Entra ID Manager
const entraIdManager = new EntraIDManager({
  tenantId: process.env.AZURE_TENANT_ID,
  clientId: process.env.AZURE_CLIENT_ID,
  clientSecret: process.env.AZURE_CLIENT_SECRET,
});

// Initialize immuDB audit logger
const immudbLogger = new ImmuDBLogger({
  host: process.env.IMMUDB_HOST,
  port: Number(process.env.IMMUDB_PORT),
  user: process.env.IMMUDB_USER,
  password: process.env.IMMUDB_PASSWORD,
  database: process.env.IMMUDB_DATABASE,
  mode: process.env.IMMUDB_MODE || "kv", // kv | sql | both
  enabled: process.env.IMMUDB_ENABLED !== "false",
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
  {
    name: "search_user_by_name",
    description:
      "Search for users by display name in EntraID. Returns matching users with their UPN, display name, and account status.",
    inputSchema: {
      type: "object",
      properties: {
        displayName: {
          type: "string",
          description:
            "Full or partial display name to search for (case-sensitive, searches for names starting with the provided text)",
        },
      },
      required: ["displayName"],
    },
  },
  {
    name: "search_user_by_job_title",
    description:
      "Search for users by job title in EntraID. Returns matching users with their UPN, display name, job title, department, and account status.",
    inputSchema: {
      type: "object",
      properties: {
        jobTitle: {
          type: "string",
          description:
            "Job title to search for (case-sensitive, searches for titles starting with the provided text)",
        },
      },
      required: ["jobTitle"],
    },
  },
  {
    name: "search_user_by_department",
    description:
      "Search for users by department in EntraID. Returns matching users with their UPN, display name, job title, department, and account status.",
    inputSchema: {
      type: "object",
      properties: {
        department: {
          type: "string",
          description:
            "Department to search for (case-sensitive, searches for departments starting with the provided text)",
        },
      },
      required: ["department"],
    },
  },
  {
    name: "enable_user_by_name",
    description:
      "Enable a user account by display name. If multiple matches are found, returns the list for you to use the exact UPN.",
    inputSchema: {
      type: "object",
      properties: {
        displayName: {
          type: "string",
          description: "Display name of the user to enable",
        },
      },
      required: ["displayName"],
    },
  },
  {
    name: "disable_user_by_name",
    description:
      "Disable a user account by display name. Guest users (containing #EXT# in their UPN) cannot be disabled. If multiple matches are found, returns the list for you to use the exact UPN.",
    inputSchema: {
      type: "object",
      properties: {
        displayName: {
          type: "string",
          description: "Display name of the user to disable",
        },
      },
      required: ["displayName"],
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
      case "search_user_by_name":
        result = await entraIdManager.searchUserByName(args.displayName);
        break;
      case "search_user_by_job_title":
        result = await entraIdManager.searchUserByJobTitle(args.jobTitle);
        break;
      case "search_user_by_department":
        result = await entraIdManager.searchUserByDepartment(args.department);
        break;
      case "enable_user_by_name":
        result = await entraIdManager.enableUserByName(args.displayName);
        break;
      case "disable_user_by_name":
        result = await entraIdManager.disableUserByName(args.displayName);
        break;
      default:
        return res.status(400).json({
          error: `Unknown tool: ${name}`,
        });
    }

    // Audit enable/disable operations into immuDB without blocking the response.
    const actionName =
      name === "enable_user" || name === "enable_user_by_name"
        ? "enable"
        : name === "disable_user" || name === "disable_user_by_name"
        ? "disable"
        : null;

    if (actionName && result?.success) {
      const targetUserId =
        result?.user?.id ||
        result?.user?.userPrincipalName ||
        args.userId ||
        args.displayName;

      const requesterIp = getRequesterIp(req);
      console.log(`📝 Recording audit: action=${actionName}, user=${targetUserId}, ip=${requesterIp}`);

      immudbLogger
        .recordAction({
          requesterIp,
          targetUserId,
          action: actionName,
        })
        .catch(error => {
          console.error("Failed to record immuDB audit entry", error);
        });
    } else if (actionName) {
      console.log(`⚠️  Action ${actionName} not recorded: operation failed or user not found`);
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
