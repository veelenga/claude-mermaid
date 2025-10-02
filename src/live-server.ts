import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { watch, FSWatcher } from "fs";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { loadDiagramOptions, getLiveDir } from "./file-utils.js";
import { webLogger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATE_PATH = join(__dirname, "preview-template.html");

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
    const content = await readFile(filePath, "utf-8");
    // For /view/* pages we explicitly disable live reload/WebSocket
    const html = await createLiveHtmlWrapper(content, diagramId, port, "white", false);
    res.writeHead(200, { "Content-Type": "text/html" });
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

    const html = await createLiveHtmlWrapper(content, diagramId, port, options.background, true);
    res.writeHead(200, { "Content-Type": "text/html" });
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

async function createLiveHtmlWrapper(
  content: string,
  diagramId: string,
  port: number,
  background: string = "white",
  liveEnabled: boolean = true
): Promise<string> {
  const template = await loadTemplate();

  return template
    .replaceAll("{{CONTENT}}", content)
    .replaceAll("{{DIAGRAM_ID}}", diagramId)
    .replaceAll("{{PORT}}", port.toString())
    .replaceAll("{{BACKGROUND}}", background)
    .replaceAll("{{TIMESTAMP}}", new Date().toLocaleTimeString())
    .replaceAll("{{LIVE_ENABLED}}", liveEnabled ? "true" : "false");
}
