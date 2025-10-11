import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { watch, FSWatcher } from "fs";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { deflate } from "pako";
import {
  loadDiagramOptions,
  getLiveDir,
  loadDiagramSource,
  validatePreviewId,
} from "./file-utils.js";
import { webLogger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PREVIEW_DIR = join(__dirname, "preview");
const TEMPLATE_PATH = join(PREVIEW_DIR, "template.html");
const STYLE_PATH = join(PREVIEW_DIR, "style.css");
const SCRIPT_PATH = join(PREVIEW_DIR, "script.js");
const FAVICON_PATH = join(PREVIEW_DIR, "favicon.svg");

// Content Security Policy header
// - default-src 'none': Deny all by default
// - script-src 'self': Only allow scripts from same origin
// - style-src 'self' 'unsafe-inline': Allow CSS from same origin and inline styles (for background color)
// - img-src 'self' data:: Allow images from same origin and data URIs (SVG may contain embedded images)
// - connect-src 'self' ws://localhost:*: Allow WebSocket connections to localhost for live reload
const CSP_HEADER =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:*";

// Live directories are resolved via shared utils (respects XDG_CONFIG_HOME/HOME)

interface DiagramState {
  filePath: string;
  watcher: FSWatcher;
  clients: Set<WebSocket>;
}

let liveServer: HttpServer | null = null;
let liveServerPort: number | null = null;
let wss: WebSocketServer | null = null;
const diagrams = new Map<string, DiagramState>();

async function findAvailablePort(
  startPort: number = 3737,
  maxPort: number = 3747
): Promise<number> {
  for (let port = startPort; port <= maxPort; port++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const testServer = createServer();
        testServer.once("error", reject);
        testServer.once("listening", () => {
          testServer.close(() => resolve());
        });
        testServer.listen(port);
      });
      return port;
    } catch (error) {
      continue;
    }
  }
  throw new Error(`No available ports found between ${startPort} and ${maxPort}`);
}

async function handleViewRequest(url: string, res: ServerResponse, port: number): Promise<void> {
  const diagramId = url.substring(6);
  const filePath = join(getLiveDir(), diagramId, "diagram.svg");

  webLogger.debug(`View request for diagram: ${diagramId}`);

  try {
    const [content, options] = await Promise.all([
      readFile(filePath, "utf-8"),
      loadDiagramOptions(diagramId).catch(() => ({
        theme: "default",
        background: "white",
        width: 800,
        height: 600,
        scale: 2,
      })),
    ]);

    const background = options.background ?? "white";
    const theme = options.theme ?? "default";

    // For /view/* pages we explicitly disable live reload/WebSocket
    const html = await createLiveHtmlWrapper(content, diagramId, port, background, false, theme);
    res.writeHead(200, {
      "Content-Type": "text/html",
      "Content-Security-Policy": CSP_HEADER,
    });
    res.end(html);
    webLogger.info(`Served view for diagram: ${diagramId}`);
  } catch (error) {
    webLogger.warn(`Diagram not found: ${diagramId}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(`Diagram not found: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleLivePreviewRequest(
  url: string,
  res: ServerResponse,
  port: number
): Promise<void> {
  const diagramId = url.substring(1);

  webLogger.debug(`Live preview request for: ${diagramId}`);

  if (!diagramId || !diagrams.has(diagramId)) {
    webLogger.warn(`Live preview - diagram not registered: ${diagramId}`);
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Diagram not found");
    return;
  }

  const state = diagrams.get(diagramId)!;

  try {
    const [content, options] = await Promise.all([
      readFile(state.filePath, "utf-8"),
      loadDiagramOptions(diagramId),
    ]);

    const html = await createLiveHtmlWrapper(
      content,
      diagramId,
      port,
      options.background,
      true,
      options.theme
    );
    res.writeHead(200, {
      "Content-Type": "text/html",
      "Content-Security-Policy": CSP_HEADER,
    });
    res.end(html);
    webLogger.info(`Served live preview for: ${diagramId}`, {
      clientCount: state.clients.size,
    });
  } catch (error) {
    webLogger.error(`Error serving live preview for: ${diagramId}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(`Error reading diagram: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleMermaidLiveRequest(url: string, res: ServerResponse): Promise<void> {
  const rawId = url.substring("/mermaid-live/".length);

  if (!rawId) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Diagram ID is required" }));
    return;
  }

  let diagramId: string;
  try {
    diagramId = decodeURIComponent(rawId);
    validatePreviewId(diagramId);
  } catch (error) {
    webLogger.warn("Invalid Mermaid Live request", {
      rawId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid diagram ID" }));
    return;
  }

  webLogger.debug(`Mermaid Live export request for: ${diagramId}`);

  try {
    const [code, options] = await Promise.all([
      loadDiagramSource(diagramId),
      loadDiagramOptions(diagramId).catch(() => ({ theme: "default" })),
    ]);

    const payload = JSON.stringify({
      code,
      mermaid: { theme: options?.theme ?? "default" },
    });

    const compressed = deflate(payload);
    const base64 = Buffer.from(compressed).toString("base64");
    const urlPayload = `https://mermaid.live/edit#pako:${base64}`;

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify({ url: urlPayload }));
    webLogger.info(`Served Mermaid Live payload for: ${diagramId}`);
  } catch (error) {
    webLogger.warn(`Mermaid Live export failed for: ${diagramId}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Diagram not found" }));
  }
}

export async function ensureLiveServer(): Promise<number> {
  if (liveServer && liveServerPort) {
    webLogger.debug(`Reusing existing server on port ${liveServerPort}`);
    return liveServerPort;
  }

  const port = await findAvailablePort();
  webLogger.info(`Starting live server on port ${port}`);

  liveServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || "/";

    try {
      // Serve static assets (CSS and JS)
      if (url === "/style.css") {
        const css = await readFile(STYLE_PATH, "utf-8");
        res.writeHead(200, { "Content-Type": "text/css" });
        res.end(css);
        return;
      }

      if (url === "/script.js") {
        const js = await readFile(SCRIPT_PATH, "utf-8");
        res.writeHead(200, { "Content-Type": "application/javascript" });
        res.end(js);
        return;
      }

      if (url.startsWith("/mermaid-live/")) {
        await handleMermaidLiveRequest(url, res);
        return;
      }

      if (url === "/favicon.svg") {
        const icon = await readFile(FAVICON_PATH);
        res.writeHead(200, {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=86400", // Cache for 24 hours
        });
        res.end(icon);
        return;
      }

      if (url === "/favicon.ico") {
        // Redirect common .ico requests to SVG favicon
        res.writeHead(302, { Location: "/favicon.svg" });
        res.end();
        return;
      }

      if (url.startsWith("/view/")) {
        await handleViewRequest(url, res, port);
        return;
      }

      await handleLivePreviewRequest(url, res, port);
    } catch (error) {
      webLogger.error(`HTTP server error for ${url}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Server error: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  wss = new WebSocketServer({ server: liveServer });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const diagramId = req.url?.substring(1);

    webLogger.info(`WebSocket connection attempt`, { diagramId, url: req.url });

    if (diagramId && diagrams.has(diagramId)) {
      const state = diagrams.get(diagramId)!;
      state.clients.add(ws);
      webLogger.info(`WebSocket client connected to diagram: ${diagramId}`, {
        clientCount: state.clients.size,
      });

      ws.on("close", () => {
        state.clients.delete(ws);
        webLogger.info(`WebSocket client disconnected from diagram: ${diagramId}`, {
          clientCount: state.clients.size,
        });
      });
    } else {
      webLogger.warn(`WebSocket connection failed - diagram not registered: ${diagramId}`);
      ws.close();
    }
  });

  await new Promise<void>((resolve) => {
    liveServer!.listen(port, () => {
      liveServerPort = port;
      webLogger.info(`Live reload server listening on port ${port}`);
      console.error(`Live reload server started on port ${port}`);
      resolve();
    });
  });

  return port;
}

export async function addLiveDiagram(diagramId: string, filePath: string): Promise<void> {
  const existingClients = diagrams.has(diagramId)
    ? diagrams.get(diagramId)!.clients
    : new Set<WebSocket>();
  const isUpdate = diagrams.has(diagramId);

  if (isUpdate) {
    diagrams.get(diagramId)!.watcher.close();
    webLogger.info(`Updating diagram: ${diagramId}`, {
      existingClientCount: existingClients.size,
    });
  } else {
    webLogger.info(`Registering new diagram: ${diagramId}`);
  }

  const watcher = watch(filePath, (eventType) => {
    if (eventType === "change") {
      webLogger.debug(`File change detected for diagram: ${diagramId}`);
      notifyClients(diagramId);
    }
  });

  diagrams.set(diagramId, {
    filePath,
    watcher,
    clients: existingClients,
  });
}

export function hasActiveConnections(diagramId: string): boolean {
  const state = diagrams.get(diagramId);
  const hasConnections = state ? state.clients.size > 0 : false;
  webLogger.debug(`Checking active connections for ${diagramId}`, {
    hasConnections,
    clientCount: state?.clients.size || 0,
  });
  return hasConnections;
}

function notifyClients(diagramId: string): void {
  const state = diagrams.get(diagramId);
  if (!state) return;

  let notifiedCount = 0;
  state.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send("reload");
      notifiedCount++;
    }
  });

  if (notifiedCount > 0) {
    webLogger.info(`Notified clients to reload diagram: ${diagramId}`, {
      notifiedCount,
      totalClients: state.clients.size,
    });
  }
}

let templateCache: string | null = null;

async function loadTemplate(): Promise<string> {
  if (!templateCache) {
    templateCache = await readFile(TEMPLATE_PATH, "utf-8");
  }
  return templateCache;
}

/**
 * Escapes HTML special characters to prevent XSS attacks
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function createLiveHtmlWrapper(
  content: string,
  diagramId: string,
  port: number,
  background: string = "white",
  liveEnabled: boolean = true,
  theme: string = "default"
): Promise<string> {
  const template = await loadTemplate();

  // Escape user-controlled values
  // CONTENT is SVG from mermaid-cli - trusted
  // DIAGRAM_ID, BACKGROUND, TIMESTAMP need escaping
  return template
    .replaceAll("{{CONTENT}}", content)
    .replaceAll("{{DIAGRAM_ID}}", escapeHtml(diagramId))
    .replaceAll("{{PORT}}", port.toString())
    .replaceAll("{{BACKGROUND}}", escapeHtml(background))
    .replaceAll("{{TIMESTAMP}}", escapeHtml(new Date().toLocaleTimeString()))
    .replaceAll("{{LIVE_ENABLED}}", liveEnabled ? "true" : "false")
    .replaceAll("{{THEME}}", escapeHtml(theme));
}
