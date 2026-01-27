import { createRequire } from "module";
import crypto from "crypto";

// Lightweight immuDB logger for recording enable/disable actions.
const require = createRequire(import.meta.url);

let ImmudbClient;
try {
  const mod = require("immudb-node");
  // immudb-node exports the client as default export
  ImmudbClient = mod.default || mod;
  console.log("✅ immudb-node loaded: ImmudbClient is", typeof ImmudbClient);
  if (!ImmudbClient || typeof ImmudbClient !== "function") {
    console.error("⚠️  immudb-node Client not found or invalid - will disable immuDB logging");
    ImmudbClient = null;
  } else {
    console.log("✅ ImmudbClient is a constructor function, ready to use");
  }
} catch (error) {
  console.error("❌ immudb-node package could not be loaded; immuDB logging disabled", error);
  ImmudbClient = null;
}

export class ImmuDBLogger {
  constructor({
    host,
    port,
    user,
    password,
    database,
    mode = "kv", // "kv" | "sql" | "both"
    enabled = true,
  } = {}) {
    if (!host || !port || !user || !password || !database) {
      throw new Error("Missing required immuDB configuration (host, port, user, password, database)");
    }

    this.address = `${host}:${port}`;
    this.user = user;
    this.password = password;
    this.database = database;
    const normalizedMode = ["kv", "sql", "both"].includes(mode) ? mode : "kv";
    this.mode = normalizedMode;
    this.useKv = normalizedMode === "kv" || normalizedMode === "both";
    this.useSql = normalizedMode === "sql" || normalizedMode === "both";
    
    this.enabled = enabled && Boolean(ImmudbClient);
    console.log(`📝 ImmuDBLogger config: enabled=${enabled}, ImmudbClient=${Boolean(ImmudbClient)}, final enabled=${this.enabled}`);
    this.client = null;
    this.ready = null;
  }

  async init() {
    if (!this.enabled) {
      console.log("📝 immuDB logging disabled");
      return;
    }

    if (!this.ready) {
      this.ready = (async () => {
        try {
          // Create client - ImmudbClient is a constructor class
          this.client = new ImmudbClient({
            host: this.address.split(":")[0],
            port: parseInt(this.address.split(":")[1]),
            rootPath: "/tmp/immudb-node-state", // Store state outside the project folder
          });

          // Login
          await this.client.login({ 
            user: this.user, 
            password: this.password 
          });

          // Use database
          await this.client.useDatabase({ databasename: this.database });
          
          if (this.useSql) {
            await this.ensureSqlArtifacts();
          }
          
          console.log(`✅ immuDB connected: ${this.address} / ${this.database} / mode=${this.mode}`);
        } catch (error) {
          console.error("❌ Failed to initialize immuDB client:", error);
          throw error;
        }
      })();
    }

    return this.ready;
  }

  async ensureSqlArtifacts() {
    const ddl =
      "CREATE TABLE IF NOT EXISTS mcp_actions(" +
      "id INTEGER AUTO_INCREMENT," +
      "requester_ip VARCHAR," +
      "target_user_id VARCHAR," +
      "action VARCHAR," +
      "ts VARCHAR," +
      "PRIMARY KEY (id))";

    // Best-effort DDL; continue even if already exists or fails to reduce startup fragility.
    try {
      await this.client.SQLExec({ sql: ddl });
      console.log("✅ SQL table mcp_actions ensured");
    } catch (error) {
      console.error("⚠️  Failed to ensure immuDB SQL table:", error.message);
    }
  }

  async recordAction({ requesterIp, targetUserId, action }) {
    if (!this.enabled) {
      console.log("⚠️  immuDB logging disabled");
      return;
    }

    if (!requesterIp || !targetUserId || !action) {
      throw new Error("requesterIp, targetUserId, and action are required to log into immuDB");
    }

    await this.init();

    const timestamp = new Date().toISOString();

    const kvWrite = async () => {
      if (!this.useKv) return;
      const key = `mcp-action:${Date.now()}:${crypto.randomBytes(6).toString("hex")}`;
      const value = JSON.stringify({ requesterIp, targetUserId, action, timestamp });
      console.log(`📝 Writing to immuDB KV: key=${key}`);
      await this.client.set({ key, value });
      console.log(`✅ Successfully wrote to immuDB`);
    };

    const sqlInsert = async () => {
      if (!this.useSql) return;
      // Escape single quotes for SQL safety
      const esc = str => String(str).replace(/'/g, "''");
      const sql =
        "INSERT INTO mcp_actions(requester_ip, target_user_id, action, ts) VALUES('" +
        `${esc(requesterIp)}','${esc(targetUserId)}','${esc(action)}','${esc(timestamp)}')`;
      console.log(`📝 Writing to immuDB SQL: INSERT mcp_actions`);
      await this.client.SQLExec({ sql });
      console.log(`✅ Successfully wrote to immuDB SQL`);
    };

    // Run whichever modes are enabled; fail independently to keep audit attempts best-effort.
    const results = await Promise.allSettled([kvWrite(), sqlInsert()]);
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`❌ Failed to write audit (${i === 0 ? 'KV' : 'SQL'}):`, r.reason);
      }
    });
  }
}
