/**
 * Application-wide constants
 * Centralizes all magic strings and numbers for maintainability
 */

// ===== Application Configuration =====
export const APP_NAME = "claude-mermaid";

// ===== Server Configuration =====
export const SERVER_PORT_START = 3737;
export const SERVER_PORT_END = 3747;

// ===== File Names =====
export const FILE_NAMES = {
  DIAGRAM_SOURCE: "diagram.mmd",
  DIAGRAM_OPTIONS: "options.json",
  DIAGRAM_SVG: "diagram.svg",
  DIAGRAM_PNG: "diagram.png",
  DIAGRAM_PDF: "diagram.pdf",
} as const;

// ===== Directory Names =====
export const DIR_NAMES = {
  LIVE: "live",
  LOGS: "logs",
  PREVIEW: "preview",
} as const;

// ===== Template Files =====
export const TEMPLATE_FILES = {
  LAYOUT: "layout.html",
  GALLERY: "gallery.html",
  DIAGRAM: "template.html",
} as const;

// ===== Static Asset Files =====
export const ASSET_FILES = {
  STYLE: "style.css",
  SHARED_STYLE: "shared.css",
  GALLERY_STYLE: "gallery.css",
  SCRIPT: "script.js",
  GALLERY_SCRIPT: "gallery.js",
  FAVICON: "favicon.svg",
} as const;

// ===== HTTP Routes =====
export const ROUTES = {
  ROOT: "/",
  GALLERY: "/",
  API_DIAGRAMS: "/api/diagrams",
  API_DIAGRAM_DELETE: "/api/diagrams/", // + :id
  VIEW: "/view/",
  MERMAID_LIVE: "/mermaid-live/",
  FAVICON_SVG: "/favicon.svg",
  FAVICON_ICO: "/favicon.ico",
  STYLE: "/style.css",
  SHARED_STYLE: "/shared.css",
  GALLERY_STYLE: "/gallery.css",
  SCRIPT: "/script.js",
  GALLERY_SCRIPT: "/gallery.js",
} as const;

// ===== HTTP Headers =====
export const CONTENT_TYPES = {
  HTML: "text/html",
  CSS: "text/css",
  JAVASCRIPT: "application/javascript",
  JSON: "application/json",
  SVG: "image/svg+xml",
  PLAIN: "text/plain",
} as const;

export const CACHE_CONTROL = {
  NO_STORE: "no-store",
  PUBLIC_24H: "public, max-age=86400",
} as const;

// Content Security Policy
// - default-src 'none': Deny all by default
// - script-src 'self': Only allow scripts from same origin
// - style-src 'self' 'unsafe-inline': Allow CSS from same origin and inline styles
// - img-src 'self' data:: Allow images from same origin and data URIs
// - connect-src 'self' ws://localhost:*: Allow WebSocket connections
export const CSP_HEADER =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:*";

// ===== Validation Patterns =====
export const PREVIEW_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

// ===== System Paths (Security) =====
export const UNIX_SYSTEM_PATHS = [
  "/etc",
  "/bin",
  "/sbin",
  "/usr/bin",
  "/usr/sbin",
  "/boot",
  "/sys",
  "/proc",
] as const;

export const WINDOWS_SYSTEM_PATHS = ["C:\\Windows", "C:\\Program Files"] as const;

// ===== Timeouts and Intervals =====
export const TIMEOUTS = {
  CLEANUP_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
} as const;

// ===== WebSocket Messages =====
export const WS_MESSAGES = {
  RELOAD: "reload",
} as const;

// ===== Template Placeholders =====
export const TEMPLATE_VARS = {
  CONTENT: "{{CONTENT}}",
  NAV: "{{NAV}}",
  FOOTER: "{{FOOTER}}",
  DIAGRAM_ID: "{{DIAGRAM_ID}}",
  PORT: "{{PORT}}",
  BACKGROUND: "{{BACKGROUND}}",
  TIMESTAMP: "{{TIMESTAMP}}",
  LIVE_ENABLED: "{{LIVE_ENABLED}}",
  PAGE_TITLE: "{{PAGE_TITLE}}",
  PAGE_SCRIPTS: "{{PAGE_SCRIPTS}}",
  PAGE_STYLES: "{{PAGE_STYLES}}",
} as const;

// ===== Diagram Options Defaults =====
export const DEFAULT_DIAGRAM_OPTIONS = {
  theme: "default",
  background: "white",
  width: 800,
  height: 600,
  scale: 2,
} as const;

// ===== Diagram Formats =====
export const DIAGRAM_FORMATS = {
  SVG: "svg",
  PNG: "png",
  PDF: "pdf",
} as const;

export type DiagramFormat = (typeof DIAGRAM_FORMATS)[keyof typeof DIAGRAM_FORMATS];
