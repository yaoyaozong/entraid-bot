import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

dotenv.config();

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.LOGVIEWER_PORT || 3002;

// Load immuDB client
let ImmudbClient;
try {
  const mod = require("immudb-node");
  ImmudbClient = mod.default || mod;
} catch (error) {
  console.error("❌ immudb-node not available:", error.message);
  ImmudbClient = null;
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Initialize immuDB connection
let immudbClient = null;

async function initImmuDB() {
  if (!ImmudbClient) {
    console.error("❌ immudb-node not loaded");
    return null;
  }

  try {
    const host = process.env.IMMUDB_HOST;
    const port = parseInt(process.env.IMMUDB_PORT);
    const user = process.env.IMMUDB_USER;
    const password = process.env.IMMUDB_PASSWORD;
    const database = process.env.IMMUDB_DATABASE;

    if (!host || !port || !user || !password || !database) {
      console.error("❌ Missing immuDB configuration");
      return null;
    }

    const client = new ImmudbClient({
      host,
      port,
      rootPath: "/tmp/immudb-logviewer-state",
    });

    await client.login({ user, password });
    await client.useDatabase({ databasename: database });

    console.log(`✅ Connected to immuDB: ${host}:${port}/${database}`);
    return client;
  } catch (error) {
    console.error("❌ Failed to connect to immuDB:", error.message);
    return null;
  }
}

// API: Check database and tables
app.get("/api/tables", async (req, res) => {
  try {
    if (!immudbClient) {
      return res.status(503).json({ error: "immuDB not connected" });
    }

    const tables = await immudbClient.SQLListTables();
    res.json({ tables });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get latest audit logs
app.get("/api/logs", async (req, res) => {
  try {
    if (!immudbClient) {
      return res.status(503).json({ error: "immuDB not connected" });
    }

    const logs = [];

    // Fetch from KV store
    try {
      const kvResult = await immudbClient.scan({
        prefix: "mcp-action:",
        limit: 100,
        desc: true,
      });

      // console.log(`📝 KV scan result:`, kvResult);

      if (kvResult?.entriesList && kvResult.entriesList.length > 0) {
        // console.log(`✅ Found ${kvResult.entriesList.length} KV entries`);
        kvResult.entriesList.forEach((entry) => {
          try {
            const key = entry.key.toString();
            const value = JSON.parse(entry.value.toString());
            logs.push({
              source: "kv",
              key: key,
              ...value,
            });
          } catch (e) {
            console.error("Failed to parse KV entry:", e.message);
          }
        });
      } else {
        // console.log("⚠️  No KV entries found");
      }
    } catch (error) {
      console.error("⚠️  Failed to fetch KV logs:", error.message);
    }

    // Fetch from SQL table if available
    try {
      const sqlResult = await immudbClient.SQLQuery({
        sql: "SELECT id, requester_ip, target_user_id, action, ts FROM mcp_actions ORDER BY id DESC LIMIT 100",
      });

      if (sqlResult) {
        sqlResult.forEach((row) => {
          // Parse SQL row - values are objects with 'prop' property
          const getId = (val) => val?.prop || val;
          const getStr = (val) => val?.prop || val || "unknown";

          logs.push({
            source: "sql",
            id: getId(row.id),
            requesterIp: getStr(row.requester_ip),
            targetUserId: getStr(row.target_user_id),
            action: getStr(row.action),
            timestamp: getStr(row.ts),
          });
        });
        // console.log(`✅ Fetched ${sqlResult.length} SQL records`);
      }
    } catch (error) {
      console.error("⚠️  Failed to fetch SQL logs:", error.message);
    }

    // Combine and sort by timestamp (latest first)
    logs.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.ts).getTime();
      const timeB = new Date(b.timestamp || b.ts).getTime();
      return timeB - timeA;
    });

    // console.log(`📊 Total logs collected: KV=${logs.filter(l => l.source === 'kv').length}, SQL=${logs.filter(l => l.source === 'sql').length}`);

    // Return latest 100
    res.json({
      count: logs.length,
      logs: logs.slice(0, 100),
    });
  } catch (error) {
    console.error("API error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: immudbClient ? "ok" : "disconnected",
    immudb: immudbClient ? "connected" : "not connected",
  });
});

// Start server
(async () => {
  try {
    // console.log("📍 Starting server initialization...");
    immudbClient = await initImmuDB();
    // console.log("📍 immuDB client initialized");

    const server = app.listen(PORT, () => {
      console.log(`🌐 Log Viewer running at http://localhost:${PORT}`);
      console.log(
        `📋 View audit logs at http://localhost:${PORT}/index.html`
      );
      if (!immudbClient) {
        console.warn(
          "⚠️  immuDB not connected - logs will not be available"
        );
      }
    });

    server.on("error", (error) => {
      console.error("❌ Server error:", error);
      process.exit(1);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
})();

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Log Viewer shutting down...");
  process.exit(0);
});
