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
    openLiveButton: document.getElementById("open-mermaid-live"),
    backToGalleryButton: document.getElementById("back-to-gallery"),
    exportButton: document.getElementById("export-btn"),
    exportMenu: document.getElementById("export-menu"),
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
    reconnectAttempts: 0,
    maxReconnectAttempts: 30,
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

  // ===== Export Functions =====
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
    if (!elements.svg) {
      alert("No diagram found to export.");
      return;
    }

    const svgClone = elements.svg.cloneNode(true);
    svgClone.removeAttribute("style");
    svgClone.style.maxWidth = "none";
    svgClone.style.maxHeight = "none";

    const svgData = new XMLSerializer().serializeToString(svgClone);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob(blob, getFilename("svg"));
  }

  function getSvgDimensions(svg) {
    const viewBox = svg.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox.split(/\s+|,/).map(Number);
      if (parts.length === 4) {
        return { width: parts[2], height: parts[3] };
      }
    }

    const width = svg.getAttribute("width");
    const height = svg.getAttribute("height");
    if (width && height) {
      return {
        width: parseFloat(width),
        height: parseFloat(height),
      };
    }

    const bbox = svg.getBBox();
    return { width: bbox.width, height: bbox.height };
  }

  function exportPng() {
    if (!elements.svg) {
      alert("No diagram found to export.");
      return;
    }

    const svgClone = elements.svg.cloneNode(true);
    svgClone.removeAttribute("style");

    const dimensions = getSvgDimensions(elements.svg);
    svgClone.setAttribute("width", dimensions.width);
    svgClone.setAttribute("height", dimensions.height);

    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = function () {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width * scale;
      canvas.height = dimensions.height * scale;

      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);

      canvas.toBlob(function (blob) {
        downloadBlob(blob, getFilename("png"));
        URL.revokeObjectURL(url);
      }, "image/png");
    };

    img.onerror = function () {
      URL.revokeObjectURL(url);
      alert("Failed to generate PNG. Try downloading as SVG instead.");
    };

    img.src = url;
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

  // ===== External Editor Functions =====
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

  function initialize() {
    initializePanZoom();
    initializeWebSocket();
  }

  // Cleanup on page unload
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

  // Register cleanup handler
  window.addEventListener("beforeunload", cleanup);

  // Start the application
  initialize();
})();
