// Preview page functionality
// Configuration is read from data attributes on the body element

(function () {
  // ===== Configuration =====
  const config = {
    diagramId: document.body.dataset.diagramId,
    port: document.body.dataset.port,
    liveEnabled: document.body.dataset.liveEnabled === "true",
    theme: document.body.dataset.theme || "default",
  };

  // ===== DOM Elements =====
  const elements = {
    viewport: document.querySelector(".viewport"),
    svg: document.querySelector("svg"),
    statusText: document.getElementById("status-text"),
    statusIndicator: document.getElementById("status-indicator"),
    resetButton: document.getElementById("reset-pan"),
    openLiveButton: document.getElementById("open-mermaid-live"),
  };

  // ===== Pan/Zoom State =====
  const panState = {
    x: 0,
    y: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
  };

  // ===== WebSocket State =====
  const wsState = {
    connection: null,
    reconnectInterval: null,
  };

  // ===== Pan/Zoom Functions =====
  function resetPan() {
    panState.x = 0;
    panState.y = 0;
    if (elements.svg) {
      elements.svg.style.transform = "";
    }
  }

  function updatePan() {
    if (elements.svg) {
      elements.svg.style.transform = `translate(${panState.x}px, ${panState.y}px)`;
    }
  }

  function handleMouseDown(e) {
    if (!elements.viewport || e.target.closest(".status-bar")) return;
    panState.isDragging = true;
    panState.dragStartX = e.clientX - panState.x;
    panState.dragStartY = e.clientY - panState.y;
    elements.viewport.style.cursor = "grabbing";
    e.preventDefault();
  }

  function handleMouseUp() {
    panState.isDragging = false;
    if (elements.viewport) {
      elements.viewport.style.cursor = "grab";
    }
  }

  function handleMouseMove(e) {
    if (!elements.viewport) return;
    if (panState.isDragging && elements.svg) {
      panState.x = e.clientX - panState.dragStartX;
      panState.y = e.clientY - panState.dragStartY;
      updatePan();
    }
  }

  // ===== Status Update Functions =====
  function setStatus(text, isConnected) {
    if (elements.statusText) {
      elements.statusText.textContent = text;
    }
    if (elements.statusIndicator) {
      elements.statusIndicator.classList.toggle("disconnected", !isConnected);
    }
  }

  // ===== WebSocket Functions =====
  function handleWebSocketOpen() {
    console.log("WebSocket connected");
    setStatus("Live Reload Active", true);
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
    setStatus("Disconnected - Reconnecting...", false);

    if (!wsState.reconnectInterval) {
      wsState.reconnectInterval = setInterval(() => {
        console.log("Attempting to reconnect...");
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

  // ===== External Editor Functions =====
  function handleOpenMermaidLive() {
    if (!config.diagramId) {
      alert("Diagram identifier is missing. Try rendering the diagram again.");
      return;
    }

    const button = elements.openLiveButton;
    const wasDisabled = button?.disabled ?? false;
    if (button) {
      button.disabled = true;
      button.classList.add("is-loading");
    }

    const baseUrl = window.location.origin;
    const requestUrl = `${baseUrl}/mermaid-live/${encodeURIComponent(config.diagramId)}`;

    fetch(requestUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unexpected response: ${response.status}`);
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
        alert("Unable to open Mermaid Live editor. Check the console for details.");
      })
      .finally(() => {
        if (button) {
          button.disabled = wasDisabled;
          button.classList.remove("is-loading");
        }
      });
  }

  // ===== Initialization =====
  function initializePanZoom() {
    if (elements.viewport) {
      elements.viewport.addEventListener("mousedown", handleMouseDown);
      document.addEventListener("mouseup", handleMouseUp);
      elements.viewport.addEventListener("mousemove", handleMouseMove);
      elements.viewport.style.cursor = "grab";
    }
    if (elements.resetButton) {
      elements.resetButton.addEventListener("click", resetPan);
    }
    if (elements.openLiveButton) {
      elements.openLiveButton.addEventListener("click", handleOpenMermaidLive);
    }
  }

  function initializeWebSocket() {
    if (!config.liveEnabled) {
      setStatus("Static View", false);
      return;
    }
    connectWebSocket();
  }

  function initialize() {
    initializePanZoom();
    initializeWebSocket();
  }

  // Start the application
  initialize();
})();
