// Preview page functionality
// Configuration is read from data attributes on the body element

(function () {
  // ===== Configuration =====
  const config = {
    diagramId: document.body.dataset.diagramId,
    port: document.body.dataset.port,
    liveEnabled: document.body.dataset.liveEnabled === "true",
  };

  // ===== DOM Elements =====
  const elements = {
    viewport: document.querySelector(".viewport"),
    svg: document.querySelector("svg"),
    statusText: document.getElementById("status-text"),
    statusIndicator: document.getElementById("status-indicator"),
    resetButton: document.getElementById("reset-pan"),
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
    if (e.target.closest(".status-bar")) return;
    panState.isDragging = true;
    panState.dragStartX = e.clientX - panState.x;
    panState.dragStartY = e.clientY - panState.y;
    elements.viewport.style.cursor = "grabbing";
    e.preventDefault();
  }

  function handleMouseUp() {
    panState.isDragging = false;
    elements.viewport.style.cursor = "grab";
  }

  function handleMouseMove(e) {
    if (panState.isDragging && elements.svg) {
      panState.x = e.clientX - panState.dragStartX;
      panState.y = e.clientY - panState.dragStartY;
      updatePan();
    }
  }

  // ===== Status Update Functions =====
  function setStatus(text, isConnected) {
    elements.statusText.textContent = text;
    if (isConnected) {
      elements.statusIndicator.classList.remove("disconnected");
    } else {
      elements.statusIndicator.classList.add("disconnected");
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
    wsState.connection = new WebSocket(`ws://localhost:${config.port}/${config.diagramId}`);
    wsState.connection.onopen = handleWebSocketOpen;
    wsState.connection.onmessage = handleWebSocketMessage;
    wsState.connection.onclose = handleWebSocketClose;
    wsState.connection.onerror = handleWebSocketError;
  }

  // ===== Initialization =====
  function initializePanZoom() {
    elements.viewport.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);
    elements.viewport.addEventListener("mousemove", handleMouseMove);
    elements.resetButton.addEventListener("click", resetPan);
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
