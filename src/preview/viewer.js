// Diagram viewer: pan, zoom and copy controls shared by the live preview and the artifact page

(function () {
  // ===== Constants =====
  const MIN_SCALE = 0.1;
  const MAX_SCALE = 10;
  const ZOOM_BUTTON_FACTOR = 1.2;
  const WHEEL_ZOOM_FACTOR = 0.001;
  const COPY_FEEDBACK_MS = 1500;
  const COPY_SUCCESS_LABEL = "✓";
  const COPY_FAILURE_LABEL = "✕";

  // ===== DOM Elements =====
  const elements = {
    viewport: document.querySelector(".viewport"),
    diagramWrapper: document.querySelector(".diagram-wrapper"),
    svg: document.querySelector(".diagram-wrapper svg"),
    resetButton: document.getElementById("reset-pan"),
    zoomInButton: document.getElementById("zoom-in"),
    zoomOutButton: document.getElementById("zoom-out"),
    zoomLevel: document.getElementById("zoom-level"),
    copyButton: document.getElementById("copy-svg"),
  };

  // ===== Pan/Zoom State =====
  const panState = {
    x: 0,
    y: 0,
    scale: 1,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
  };

  // ===== Pan/Zoom Functions =====
  function clampScale(value) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
  }

  function updateZoomLevel() {
    if (elements.zoomLevel) {
      elements.zoomLevel.textContent = `${Math.round(panState.scale * 100)}%`;
    }
  }

  function resetView() {
    panState.x = 0;
    panState.y = 0;
    panState.scale = 1;
    applyTransform();
    updateZoomLevel();
  }

  function applyTransform() {
    if (elements.diagramWrapper) {
      elements.diagramWrapper.style.transform = `translate(${panState.x}px, ${panState.y}px) scale(${panState.scale})`;
    }
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
    const newScale = panState.scale * (1 + delta);
    zoomAtPoint(newScale, pivotX, pivotY);
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
    if (panState.isDragging) {
      panState.x = e.clientX - panState.dragStartX;
      panState.y = e.clientY - panState.dragStartY;
      applyTransform();
    }
  }

  // ===== Touch Event Handlers =====
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

  // ===== Copy Functions =====
  function serializeSvg() {
    const svgClone = elements.svg.cloneNode(true);
    svgClone.removeAttribute("style");
    svgClone.style.maxWidth = "none";
    svgClone.style.maxHeight = "none";
    return new XMLSerializer().serializeToString(svgClone);
  }

  function copyWithSelection(text) {
    const field = document.createElement("textarea");
    field.value = text;
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const isCopied = document.execCommand("copy");
    field.remove();
    return isCopied;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return copyWithSelection(text);
    }
  }

  function copySvg() {
    const button = elements.copyButton;
    const label = button.textContent;

    button.disabled = true;
    copyText(serializeSvg()).then(function (isCopied) {
      button.textContent = isCopied ? COPY_SUCCESS_LABEL : COPY_FAILURE_LABEL;
      setTimeout(function () {
        button.textContent = label;
        button.disabled = false;
      }, COPY_FEEDBACK_MS);
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
    if (elements.copyButton && elements.svg) {
      elements.copyButton.addEventListener("click", copySvg);
    }
  }

  window.diagramViewer = { serializeSvg: serializeSvg };

  initialize();
})();
