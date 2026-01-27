let allLogs = [];
let autoRefreshInterval = null;
let autoRefreshEnabled = false;

// Get the API base URL that works with reverse proxies
function getApiUrl(endpoint) {
  // Use relative path with current page location
  // This works when accessed directly or through a reverse proxy subpath
  const path = window.location.pathname;
  const basePath = path.endsWith('/') ? path : path + '/';
  return basePath + 'api' + endpoint;
}

// Fetch logs from API
async function fetchLogs() {
  try {
    updateStatus("Loading...", "loading");
    const response = await fetch(getApiUrl("/logs"));
    const data = await response.json();

    if (response.ok) {
      allLogs = data.logs || [];
      updateStatus("Connected", "connected");
      renderLogs(allLogs);
    } else {
      updateStatus("Error: " + data.error, "disconnected");
      showError("Failed to fetch logs: " + data.error);
    }
  } catch (error) {
    updateStatus("Disconnected", "disconnected");
    showError("Connection error: " + error.message);
  }
}

// Update status indicator
function updateStatus(text, status) {
  const statusText = document.getElementById("status-text");
  const statusIndicator = document.getElementById("status-indicator");

  statusText.textContent = text;
  statusIndicator.classList.remove("connected", "disconnected");
  statusIndicator.classList.add(status);
}

// Show error message
function showError(message) {
  const tbody = document.getElementById("logs-tbody");
  tbody.innerHTML = `<tr><td colspan="5" class="loading" style="color: #f44336;">${message}</td></tr>`;
}

// Format timestamp
function formatTimestamp(timestamp) {
  if (!timestamp) return "N/A";
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Render logs in table
function renderLogs(logsToRender) {
  const tbody = document.getElementById("logs-tbody");

  if (logsToRender.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="loading">No audit logs found</td></tr>';
    document.getElementById("log-count").textContent = "Showing 0 entries";
    return;
  }

  tbody.innerHTML = logsToRender
    .map((log) => {
      const action = log.action || "unknown";
      const timestamp = formatTimestamp(log.timestamp || log.ts);
      const requesterIp = log.requesterIp || "unknown";
      const targetUserId = log.targetUserId || "unknown";
      const source = log.source || "unknown";

      return `
        <tr>
          <td class="timestamp">${timestamp}</td>
          <td><span class="action ${action}">${action.toUpperCase()}</span></td>
          <td>${targetUserId}</td>
          <td>${requesterIp}</td>
          <td><span class="source ${source}">${source.toUpperCase()}</span></td>
        </tr>
      `;
    })
    .join("");

  document.getElementById("log-count").textContent = `Showing ${logsToRender.length} entries`;
}

// Filter logs based on search and filters
function applyFilters() {
  const searchText = document
    .getElementById("search-box")
    .value.toLowerCase();
  const actionFilter = document.getElementById("filter-action").value;
  const sourceFilter = document.getElementById("filter-source").value;

  const filtered = allLogs.filter((log) => {
    const matchesSearch =
      !searchText ||
      (log.requesterIp || "").toLowerCase().includes(searchText) ||
      (log.targetUserId || "").toLowerCase().includes(searchText) ||
      (log.action || "").toLowerCase().includes(searchText);

    const matchesAction =
      !actionFilter || (log.action || "").toLowerCase() === actionFilter;

    const matchesSource =
      !sourceFilter || (log.source || "").toLowerCase() === sourceFilter;

    return matchesSearch && matchesAction && matchesSource;
  });

  renderLogs(filtered);
}

// Toggle auto-refresh
function toggleAutoRefresh(enabled) {
  autoRefreshEnabled = enabled;
  const toggle = document.getElementById("auto-refresh-toggle");
  const label = document.querySelector(".auto-refresh-toggle span");
  
  if (autoRefreshEnabled) {
    autoRefreshInterval = setInterval(fetchLogs, 5000);
    label.textContent = "Auto-refresh (on)";
    toggle.checked = true;
  } else {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
    label.textContent = "Auto-refresh (off)";
    toggle.checked = false;
  }
}

// Event listeners
document.getElementById("refresh-btn").addEventListener("click", fetchLogs);
document
  .getElementById("search-box")
  .addEventListener("input", applyFilters);
document
  .getElementById("filter-action")
  .addEventListener("change", applyFilters);
document
  .getElementById("filter-source")
  .addEventListener("change", applyFilters);
document
  .getElementById("auto-refresh-toggle")
  .addEventListener("change", (e) => toggleAutoRefresh(e.target.checked));

// Initial load (without auto-refresh)
fetchLogs();
