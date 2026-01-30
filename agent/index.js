import OpenAI from "openai";
import axios from "axios";
import dotenv from "dotenv";
import readline from "readline";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "http://localhost:3001";

// Get available tools from MCP server
async function getAvailableTools() {
  try {
    const response = await axios.get(`${MCP_SERVER_URL}/tools`);
    return response.data.tools || [];
  } catch (error) {
    console.error("⚠️  Could not retrieve tools from MCP server");
    return [];
  }
}

// Call tool via MCP server
async function callMCPTool(toolName, toolInput, requesterIp = "cli-agent", authenticatedUser = "cli-agent") {
  try {
    console.log(`\n🔧 Calling tool: ${toolName}`);
    console.log(`   Input: ${JSON.stringify(toolInput)}`);

    const response = await axios.post(`${MCP_SERVER_URL}/call-tool`, {
      name: toolName,
      arguments: toolInput,
      requesterIp,
      authenticatedUser,
    });

    if (response.data.success) {
      const result = JSON.stringify(response.data.result, null, 2);
      console.log(`   Result: ${result}`);
      return result;
    }

    throw new Error(response.data.error || "Unknown error");
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message;
    console.log(`   Error: ${errorMsg}`);
    return errorMsg;
  }
}

// Main agent loop
async function runAgent() {
  console.log("🚀 Starting EntraID Agent...\n");

  try {
    // Check MCP server connection
    try {
      const response = await axios.get(`${MCP_SERVER_URL}/health`);
      console.log(`✅ Connected to MCP Server at ${MCP_SERVER_URL}\n`);
    } catch (error) {
      console.error(
        `❌ Cannot connect to MCP Server at ${MCP_SERVER_URL}`
      );
      console.error("Make sure the MCP server is running!");
      console.error(
        `Start it with: cd mcp-server && npm install && npm start\n`
      );
      process.exit(1);
    }

    // Get available tools
    let tools = await getAvailableTools();
    if (tools.length === 0) {
      console.warn("⚠️  No tools found from MCP server");
      tools = [
        {
          name: "enable_user",
          description: "Enable a user account",
          inputSchema: {
            type: "object",
            properties: {
              userId: { type: "string" },
            },
            required: ["userId"],
          },
        },
        {
          name: "disable_user",
          description: "Disable a user account",
          inputSchema: {
            type: "object",
            properties: {
              userId: { type: "string" },
            },
            required: ["userId"],
          },
        },
        {
          name: "get_user_status",
          description: "Get user account status",
          inputSchema: {
            type: "object",
            properties: {
              userId: { type: "string" },
            },
            required: ["userId"],
          },
        },
      ];
    }

    console.log("📋 Available tools:");
    tools.forEach((tool) => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });

    // Convert tools to OpenAI format
    const openaiTools = tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    // Create readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (prompt) =>
      new Promise((resolve) => {
        rl.question(prompt, resolve);
      });

    // Main conversation loop with system prompt
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

    const messages = [systemPrompt];

    console.log("\n💬 Chat with the EntraID Agent");
    console.log('Commands: Type your request or "exit" to quit\n');

    while (true) {
      const userInput = await question("You: ");

      if (userInput.toLowerCase() === "exit") {
        console.log("👋 Goodbye!");
        break;
      }

      messages.push({
        role: "user",
        content: userInput,
      });

      let continueLoop = true;
      let loopCount = 0;
      const maxLoops = 5;

      while (continueLoop && loopCount < maxLoops) {
        loopCount++;

        try {
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
            console.log("\nAgent is thinking...");

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
                const result = await callMCPTool(toolName, toolInput, "cli-agent", "cli-agent");
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
            const finalResponse =
              response.choices?.[0]?.message?.content || "No response";
            if (finalResponse) {
              console.log(`\nAgent: ${finalResponse}\n`);
            }
            continueLoop = false;
          }
        } catch (error) {
          console.error(`❌ OpenAI error: ${error.message}`);
          continueLoop = false;
        }
      }
    }

    rl.close();
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

runAgent();
