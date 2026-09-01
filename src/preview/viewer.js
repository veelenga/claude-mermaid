// Diagram viewer: pan, zoom and copy controls shared by the live preview and artifact pages
// Configuration is read from data attributes on the element carrying data-diagram-id

(function () {
  const configRoot = document.querySelector("[data-diagram-id]") || document.body;
  const config = {
    diagramId: configRoot.dataset.diagramId,
    port: configRoot.dataset.port,
    liveEnabled: configRoot.dataset.liveEnabled === "true",
  };

  const MIN_SCALE = 0.1;
  const MAX_SCALE = 10;
  const ZOOM_BUTTON_FACTOR = 1.2;
  const WHEEL_ZOOM_FACTOR = 0.001;
  const COPY_FEEDBACK_MS = 1500;
  const COPY_DONE_LABEL = "✓";

  const elements = {
    viewport: document.querySelector(".viewport"),
    diagramWrapper: document.querySelector(".diagram-wrapper"),
    svg: document.querySelector("svg"),
    resetButton: document.getElementById("reset-pan"),
    zoomInButton: document.getElementById("zoom-in"),
    zoomOutButton: document.getElementById("zoom-out"),
    zoomLevel: document.getElementById("zoom-level"),
    copySvgButton: document.getElementById("copy-svg"),
  };

  const panState = {
    x: 0,
    y: 0,
    scale: 1,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
  };

  // ===== Pan/Zoom =====
  function clampScale(value) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
  }

  function updateZoomLevel() {
    if (elements.zoomLevel) {
      elements.zoomLevel.textContent = `${Math.round(panState.scale * 100)}%`;
    }
  }

  function applyTransform() {
    if (elements.diagramWrapper) {
      elements.diagramWrapper.style.transform = `translate(${panState.x}px, ${panState.y}px) scale(${panState.scale})`;
    }
  }

  function resetView() {
    panState.x = 0;
    panState.y = 0;
    panState.scale = 1;
    applyTransform();
    updateZoomLevel();
  }

  function zoomAtPoint(newScale, pivotX, pivotY) {
    newScale = clampScale(newScale);
    const ratio = 1 - newScale / panState.scale;
    panState.x += (pivotX - panState.x) * ratio;
    panState.y += (pivotY - panState.y) * ratio;
    panState.scale = newScale;
    applyTransform();
    updateZoomLevel();
  }

  function zoomAtCenter(newScale) {
    if (!elements.viewport) return;
    const rect = elements.viewport.getBoundingClientRect();
    zoomAtPoint(newScale, rect.width / 2, rect.height / 2);
  }

  function normalizeWheelDelta(e) {
    var deltaY = e.deltaY;
    if (e.deltaMode === 1) deltaY *= 40;
    else if (e.deltaMode === 2) deltaY *= 800;
    return deltaY;
  }

  function handleWheel(e) {
    if (!elements.viewport) return;
    e.preventDefault();

    const rect = elements.viewport.getBoundingClientRect();
    const pivotX = e.clientX - rect.left;
    const pivotY = e.clientY - rect.top;

    const delta = -normalizeWheelDelta(e) * WHEEL_ZOOM_FACTOR;
    zoomAtPoint(panState.scale * (1 + delta), pivotX, pivotY);
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
    if (!elements.viewport || !panState.isDragging) return;
    panState.x = e.clientX - panState.dragStartX;
    panState.y = e.clientY - panState.dragStartY;
    applyTransform();
  }

  function handleTouchStart(e) {
    if (!elements.viewport || e.target.closest(".status-bar")) return;
    if (e.touches.length !== 1) return;
    panState.isDragging = true;
    panState.dragStartX = e.touches[0].clientX - panState.x;
    panState.dragStartY = e.touches[0].clientY - panState.y;
    e.preventDefault();
  }

  function handleTouchMove(e) {
    if (!panState.isDragging || e.touches.length !== 1) return;
    panState.x = e.touches[0].clientX - panState.dragStartX;
    panState.y = e.touches[0].clientY - panState.dragStartY;
    applyTransform();
    e.preventDefault();
  }

  function handleTouchEnd() {
    panState.isDragging = false;
  }

  // ===== SVG access =====
  function serializeSvg() {
    const svgClone = elements.svg.cloneNode(true);
    svgClone.removeAttribute("style");
    svgClone.style.maxWidth = "none";
    svgClone.style.maxHeight = "none";
    return new XMLSerializer().serializeToString(svgClone);
  }

  function flashButtonLabel(button, label) {
    const original = button.textContent;
    button.textContent = label;
    button.disabled = true;
    setTimeout(function () {
      button.textContent = original;
      button.disabled = false;
    }, COPY_FEEDBACK_MS);
  }

  function copySvg() {
    if (!elements.svg || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(serializeSvg())
      .then(function () {
        flashButtonLabel(elements.copySvgButton, COPY_DONE_LABEL);
      })
      .catch(function (error) {
        console.error("Copy SVG failed", error);
      });
  }

  // ===== Initialization =====
  function initialize() {
    if (elements.viewport) {
      elements.viewport.addEventListener("mousedown", handleMouseDown);
      document.addEventListener("mouseup", handleMouseUp);
      elements.viewport.addEventListener("mousemove", handleMouseMove);
      elements.viewport.addEventListener("wheel", handleWheel, { passive: false });
      elements.viewport.addEventListener("touchstart", handleTouchStart, { passive: false });
      elements.viewport.addEventListener("touchmove", handleTouchMove, { passive: false });
      elements.viewport.addEventListener("touchend", handleTouchEnd);
      elements.viewport.style.cursor = "grab";
    }
    if (elements.resetButton) {
      elements.resetButton.addEventListener("click", resetView);
    }
    if (elements.zoomInButton) {
      elements.zoomInButton.addEventListener("click", function () {
        zoomAtCenter(panState.scale * ZOOM_BUTTON_FACTOR);
      });
    }
    if (elements.zoomOutButton) {
      elements.zoomOutButton.addEventListener("click", function () {
        zoomAtCenter(panState.scale / ZOOM_BUTTON_FACTOR);
      });
    }
    if (elements.copySvgButton) {
      elements.copySvgButton.addEventListener("click", copySvg);
    }
  }

  initialize();

  window.ClaudeMermaidViewer = {
    config: config,
    hasSvg: function () {
      return Boolean(elements.svg);
    },
    serializeSvg: serializeSvg,
  };
})();
