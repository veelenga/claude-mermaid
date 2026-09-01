// Live preview page: websocket reload, export and editor links
// Depends on viewer.js for configuration and SVG access

(function () {
  const viewer = window.ClaudeMermaidViewer;
  const config = viewer.config;

  const elements = {
    statusText: document.getElementById("status-text"),
    statusIndicator: document.getElementById("status-indicator"),
    openLiveButton: document.getElementById("open-mermaid-live"),
    backToGalleryButton: document.getElementById("back-to-gallery"),
    exportButton: document.getElementById("export-btn"),
    exportMenu: document.getElementById("export-menu"),
  };

  const wsState = {
    connection: null,
    reconnectInterval: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 30,
  };

  // ===== Status =====
  function setStatus(text, isConnected) {
    if (elements.statusText) {
      elements.statusText.textContent = text;
    }
    if (elements.statusIndicator) {
      elements.statusIndicator.classList.toggle("disconnected", !isConnected);
    }
  }

  // ===== WebSocket =====
  function handleWebSocketOpen() {
    console.log("WebSocket connected");
    setStatus("Live Reload Active", true);
    wsState.reconnectAttempts = 0;
    if (wsState.reconnectInterval) {
      clearInterval(wsState.reconnectInterval);
      wsState.reconnectInterval = null;
    }
  }

  function handleWebSocketMessage(event) {
    if (event.data === "reload") {
      console.log("Reloading diagram...");
      location.reload();
    }
  }

  function handleWebSocketClose() {
    console.log("WebSocket disconnected");

    if (wsState.reconnectAttempts >= wsState.maxReconnectAttempts) {
      setStatus("Connection failed - Reload page to retry", false);
      console.warn(
        `Max reconnection attempts (${wsState.maxReconnectAttempts}) reached. Stop reconnecting.`
      );
      return;
    }

    setStatus("Disconnected - Reconnecting...", false);

    if (!wsState.reconnectInterval) {
      wsState.reconnectInterval = setInterval(() => {
        if (wsState.reconnectAttempts >= wsState.maxReconnectAttempts) {
          clearInterval(wsState.reconnectInterval);
          wsState.reconnectInterval = null;
          setStatus("Connection failed - Reload page to retry", false);
          return;
        }
        wsState.reconnectAttempts++;
        console.log(
          `Attempting to reconnect... (${wsState.reconnectAttempts}/${wsState.maxReconnectAttempts})`
        );
        connectWebSocket();
      }, 2000);
    }
  }

  function handleWebSocketError(error) {
    console.error("WebSocket error:", error);
    if (wsState.connection) {
      wsState.connection.close();
    }
  }

  function connectWebSocket() {
    if (!config.port || !config.diagramId) return;
    wsState.connection = new WebSocket(`ws://localhost:${config.port}/${config.diagramId}`);
    wsState.connection.onopen = handleWebSocketOpen;
    wsState.connection.onmessage = handleWebSocketMessage;
    wsState.connection.onclose = handleWebSocketClose;
    wsState.connection.onerror = handleWebSocketError;
  }

  // ===== Export =====
  function getFilename(format) {
    return `${config.diagramId || "diagram"}.${format}`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportSvg() {
    if (!viewer.hasSvg()) {
      alert("No diagram found to export.");
      return;
    }

    const blob = new Blob([viewer.serializeSvg()], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob(blob, getFilename("svg"));
  }

  function exportPng() {
    if (!config.diagramId) {
      alert("No diagram found to export.");
      return;
    }

    const baseUrl = window.location.origin;
    const exportUrl = `${baseUrl}/export/${encodeURIComponent(config.diagramId)}`;

    fetch(exportUrl)
      .then(function (response) {
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        return response.blob();
      })
      .then(function (blob) {
        downloadBlob(blob, getFilename("png"));
      })
      .catch(function (error) {
        console.error("PNG export failed", error);
        alert("Failed to generate PNG. Try downloading as SVG instead.");
      });
  }

  function handleExport(format) {
    hideExportMenu();

    if (format === "svg") {
      exportSvg();
    } else if (format === "png") {
      exportPng();
    }
  }

  function toggleExportMenu() {
    if (elements.exportMenu) {
      elements.exportMenu.classList.toggle("visible");
    }
  }

  function hideExportMenu() {
    if (elements.exportMenu) {
      elements.exportMenu.classList.remove("visible");
    }
  }

  // ===== External editor =====
  function handleOpenMermaidLive() {
    if (!config.diagramId) {
      alert("Diagram identifier is missing. Try rendering the diagram again.");
      return;
    }

    const button = elements.openLiveButton;
    if (button) {
      button.disabled = true;
      button.classList.add("is-loading");
    }

    const baseUrl = window.location.origin;
    const requestUrl = `${baseUrl}/mermaid-live/${encodeURIComponent(config.diagramId)}`;

    fetch(requestUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then((data) => {
        const url = data?.url;
        if (!url) {
          throw new Error("Mermaid Live URL missing in response");
        }
        window.open(url, "_blank", "noopener,noreferrer");
      })
      .catch((error) => {
        console.error("Failed to open Mermaid Live editor", error);
        const message = error.message || "Unknown error occurred";
        alert(`Unable to open Mermaid Live editor: ${message}`);
      })
      .finally(() => {
        if (button) {
          button.disabled = false;
          button.classList.remove("is-loading");
        }
      });
  }

  // ===== Initialization =====
  function initializeToolbar() {
    if (elements.openLiveButton) {
      elements.openLiveButton.addEventListener("click", handleOpenMermaidLive);
    }
    if (elements.backToGalleryButton) {
      elements.backToGalleryButton.addEventListener("click", function () {
        window.location.href = "/";
      });
    }
    if (elements.exportButton) {
      elements.exportButton.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleExportMenu();
      });
    }
    if (elements.exportMenu) {
      elements.exportMenu.querySelectorAll(".export-option").forEach(function (btn) {
        btn.addEventListener("click", function () {
          handleExport(this.dataset.format);
        });
      });
    }
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".export-dropdown")) {
        hideExportMenu();
      }
    });
  }

  function initializeWebSocket() {
    if (!config.liveEnabled) {
      setStatus("Static View", false);
      return;
    }
    connectWebSocket();
  }

  function cleanup() {
    if (wsState.connection) {
      wsState.connection.close();
      wsState.connection = null;
    }
    if (wsState.reconnectInterval) {
      clearInterval(wsState.reconnectInterval);
      wsState.reconnectInterval = null;
    }
  }

  window.addEventListener("beforeunload", cleanup);

  initializeToolbar();
  initializeWebSocket();
})();
