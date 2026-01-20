let conversationId = null;
let isLoading = false;

const messagesContainer = document.getElementById("messagesContainer");
const messageInput = document.getElementById("messageInput");
const chatForm = document.getElementById("chatForm");
const clearBtn = document.getElementById("clearBtn");
const sendBtn = document.getElementById("sendBtn");
const statusIndicator = document.querySelector(".status-dot");
const statusText = document.getElementById("statusText");

// Check health status on load
async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    if (response.ok) {
      updateStatus(true);
    } else {
      updateStatus(false);
    }
  } catch (error) {
    updateStatus(false);
  }
}

function updateStatus(connected) {
  if (connected) {
    statusIndicator.classList.add("connected");
    statusIndicator.classList.remove("disconnected");
    statusText.textContent = "Connected";
  } else {
    statusIndicator.classList.remove("connected");
    statusIndicator.classList.add("disconnected");
    statusText.textContent = "Disconnected";
  }
}

// Add message to UI
function addMessage(content, role = "user") {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  contentDiv.textContent = content;

  messageDiv.appendChild(contentDiv);
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show typing indicator
function showTypingIndicator() {
  const messageDiv = document.createElement("div");
  messageDiv.className = "message assistant";
  messageDiv.id = "typingIndicator";

  const contentDiv = document.createElement("div");
  contentDiv.className = "typing-indicator";
  contentDiv.innerHTML =
    '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';

  messageDiv.appendChild(contentDiv);
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Remove typing indicator
function removeTypingIndicator() {
  const typingIndicator = document.getElementById("typingIndicator");
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

// Send message
async function sendMessage() {
  const message = messageInput.value.trim();

  if (!message || isLoading) {
    return;
  }

  isLoading = true;
  sendBtn.disabled = true;

  // Add user message to UI
  addMessage(message, "user");
  messageInput.value = "";

  // Show typing indicator
  showTypingIndicator();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message,
        conversationId: conversationId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Update conversation ID
    conversationId = data.conversationId;

    // Remove typing indicator
    removeTypingIndicator();

    // Add assistant response
    addMessage(data.response, "assistant");
  } catch (error) {
    removeTypingIndicator();
    addMessage(
      `Error: ${error.message}. Make sure the MCP server is running!`,
      "error"
    );
    console.error("Error:", error);
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

// Clear conversation
function clearConversation() {
  if (conversationId) {
    fetch("/api/clear", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId: conversationId,
      }),
    });
  }

  conversationId = null;
  messagesContainer.innerHTML = `
    <div class="welcome-message">
      <h2>Welcome to EntraID Manager 👋</h2>
      <p>I can help you manage user accounts in your EntraID directory.</p>
      <div class="example-prompts">
        <p>Try asking me to:</p>
        <div class="prompt-list">
          <div class="prompt-item">Enable a user account</div>
          <div class="prompt-item">Disable a user account</div>
          <div class="prompt-item">Check user status</div>
        </div>
      </div>
    </div>
  `;
  messageInput.focus();
}

// Event listeners
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage();
});

clearBtn.addEventListener("click", clearConversation);

messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Handle example prompt clicks
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("prompt-item")) {
    messageInput.value = `Can you ${e.target.textContent.toLowerCase()}?`;
    messageInput.focus();
  }
});

// Check health on page load
checkHealth();
setInterval(checkHealth, 5000); // Check every 5 seconds
