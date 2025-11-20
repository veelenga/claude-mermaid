/**
 * Gallery Client-Side Logic
 * Handles diagram loading, search, and interaction
 */

// Get port from script tag data attribute
const currentScript = document.currentScript || document.querySelector('script[data-port]');
const SERVER_PORT = currentScript ? currentScript.getAttribute('data-port') : '3737';

// State
let allDiagrams = [];
let filteredDiagrams = [];

// DOM Elements
const galleryEl = document.getElementById('gallery');
const emptyStateEl = document.getElementById('emptyState');
const noResultsEl = document.getElementById('noResults');
const searchInput = document.getElementById('searchInput');
const diagramCountEl = document.getElementById('diagramCount');

/**
 * Formats a date as relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;

  return new Date(date).toLocaleDateString();
}

/**
 * Formats file size in human-readable format
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Creates a diagram card element
 */
function createDiagramCard(diagram) {
  const card = document.createElement('a');
  card.className = 'diagram-card';
  // Use /view/ route which works for all diagrams
  card.href = `/view/${diagram.id}`;
  card.dataset.diagramId = diagram.id;

  // Preview section
  const preview = document.createElement('div');
  preview.className = 'diagram-preview';

  if (diagram.format === 'svg') {
    // Load SVG preview from the file system via fetch
    fetch(`/view/${diagram.id}`)
      .then(response => response.text())
      .then(html => {
        // Extract SVG from the HTML response
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const svg = doc.querySelector('svg');
        if (svg) {
          // Clone and append the SVG
          preview.innerHTML = '';
          preview.appendChild(svg.cloneNode(true));
        } else {
          preview.innerHTML = '<div class="diagram-preview-placeholder">📊</div>';
        }
      })
      .catch(() => {
        preview.innerHTML = '<div class="diagram-preview-placeholder">📊</div>';
      });
  } else {
    // For PNG/PDF, show placeholder
    preview.innerHTML = '<div class="diagram-preview-placeholder">📊</div>';
  }

  // Info section
  const info = document.createElement('div');
  info.className = 'diagram-info';

  const id = document.createElement('h3');
  id.className = 'diagram-id';
  id.textContent = diagram.id;

  const meta = document.createElement('div');
  meta.className = 'diagram-meta';

  const format = document.createElement('span');
  format.className = 'diagram-meta-item';
  format.innerHTML = `<span class="diagram-format">${diagram.format}</span>`;

  const modified = document.createElement('span');
  modified.className = 'diagram-meta-item';
  modified.innerHTML = `📅 ${formatRelativeTime(diagram.modifiedAt)}`;

  const size = document.createElement('span');
  size.className = 'diagram-meta-item';
  size.innerHTML = `💾 ${formatFileSize(diagram.sizeBytes)}`;

  meta.appendChild(format);
  meta.appendChild(modified);
  meta.appendChild(size);

  info.appendChild(id);
  info.appendChild(meta);

  card.appendChild(preview);
  card.appendChild(info);

  return card;
}

/**
 * Renders the gallery with current filtered diagrams
 */
function renderGallery() {
  // Clear gallery
  galleryEl.innerHTML = '';

  // Update count
  diagramCountEl.textContent = `${filteredDiagrams.length} diagram${filteredDiagrams.length !== 1 ? 's' : ''}`;

  // Show appropriate state
  if (allDiagrams.length === 0) {
    // No diagrams at all
    galleryEl.style.display = 'none';
    emptyStateEl.style.display = 'block';
    noResultsEl.style.display = 'none';
  } else if (filteredDiagrams.length === 0) {
    // No results from search
    galleryEl.style.display = 'none';
    emptyStateEl.style.display = 'none';
    noResultsEl.style.display = 'block';
  } else {
    // Show diagrams
    galleryEl.style.display = 'grid';
    emptyStateEl.style.display = 'none';
    noResultsEl.style.display = 'none';

    filteredDiagrams.forEach(diagram => {
      const card = createDiagramCard(diagram);
      galleryEl.appendChild(card);
    });
  }
}

/**
 * Filters diagrams based on search query
 */
function filterDiagrams(query) {
  if (!query || !query.trim()) {
    filteredDiagrams = [...allDiagrams];
  } else {
    const normalizedQuery = query.toLowerCase().trim();
    filteredDiagrams = allDiagrams.filter(diagram =>
      diagram.id.toLowerCase().includes(normalizedQuery)
    );
  }
  renderGallery();
}

/**
 * Loads diagrams from the API
 */
async function loadDiagrams() {
  try {
    const response = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    allDiagrams = data.diagrams || [];
    filteredDiagrams = [...allDiagrams];

    renderGallery();
  } catch (error) {
    console.error('Failed to load diagrams:', error);
    galleryEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h2 class="empty-state-title">Failed to load diagrams</h2>
        <p class="empty-state-description">${error.message}</p>
      </div>
    `;
  }
}

/**
 * Debounce function for search input
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Event Listeners
searchInput.addEventListener(
  'input',
  debounce((e) => {
    filterDiagrams(e.target.value);
  }, 300)
);

// Initialize
loadDiagrams();
