// Diagram viewer: pan, zoom and copy controls shared by the live preview and the artifact page

(function () {
  // ===== Constants =====
  const MIN_SCALE = 0.1;
  const MAX_SCALE = 10;
  const ZOOM_BUTTON_FACTOR = 1.2;
  const WHEEL_ZOOM_FACTOR = 0.001;
  const DRAG_CLICK_THRESHOLD = 5;
  const DRAGGING_CLASS = "is-dragging";
  const LINK_SELECTOR = "a[*|href]";
  const LINK_WINDOW_FEATURES = "noopener,noreferrer";
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
    dragStartClientX: 0,
    dragStartClientY: 0,
    dragStartPanX: 0,
    dragStartPanY: 0,
    movedPastThreshold: false,
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

  // ===== Drag Functions =====
  function startDrag(point) {
    panState.isDragging = true;
    panState.movedPastThreshold = false;
    panState.dragStartClientX = point.clientX;
    panState.dragStartClientY = point.clientY;
    panState.dragStartPanX = panState.x;
    panState.dragStartPanY = panState.y;
    elements.viewport.classList.add(DRAGGING_CLASS);
  }

  function dragTo(point) {
    const dx = point.clientX - panState.dragStartClientX;
    const dy = point.clientY - panState.dragStartClientY;
    if (Math.abs(dx) + Math.abs(dy) > DRAG_CLICK_THRESHOLD) {
      panState.movedPastThreshold = true;
    }
    panState.x = panState.dragStartPanX + dx;
    panState.y = panState.dragStartPanY + dy;
    applyTransform();
  }

  function endDrag() {
    panState.isDragging = false;
    elements.viewport.classList.remove(DRAGGING_CLASS);
  }

  // ===== Mouse Event Handlers =====
  function handleMouseDown(e) {
    if (e.button !== 0) return;
    startDrag(e);
    e.preventDefault();
  }

  function handleMouseMove(e) {
    if (panState.isDragging) dragTo(e);
  }

  // ===== Touch Event Handlers =====
  function handleTouchStart(e) {
    if (e.touches.length !== 1) return;
    startDrag(e.touches[0]);
  }

  function handleTouchMove(e) {
    if (!panState.isDragging || e.touches.length !== 1) return;
    dragTo(e.touches[0]);
    e.preventDefault();
  }

  // ===== Link Functions =====
  function hasModifierKey(e) {
    return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
  }

  function handleLinkClick(e) {
    const link = e.target.closest(LINK_SELECTOR);
    if (!link) return;

    const isPointerClick = e.detail > 0;
    if (isPointerClick && panState.movedPastThreshold) {
      e.preventDefault();
      return;
    }
    if (hasModifierKey(e)) return;

    e.preventDefault();
    window.open(link.href.baseVal, "_blank", LINK_WINDOW_FEATURES);
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
      document.addEventListener("mouseup", endDrag);
      elements.viewport.addEventListener("mousemove", handleMouseMove);
      elements.viewport.addEventListener("contextmenu", endDrag);
      elements.viewport.addEventListener("click", handleLinkClick);
      elements.viewport.addEventListener("wheel", handleWheel, { passive: false });
      elements.viewport.addEventListener("touchstart", handleTouchStart, { passive: true });
      elements.viewport.addEventListener("touchmove", handleTouchMove, { passive: false });
      elements.viewport.addEventListener("touchend", endDrag);
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
