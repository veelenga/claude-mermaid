import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { watch, FSWatcher } from "fs";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { loadDiagramOptions } from "./file-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATE_PATH = join(__dirname, "preview-template.html");

const CONFIG_DIR = process.env.XDG_CONFIG_HOME || `${homedir()}/.config`;
const LIVE_DIR = `${CONFIG_DIR}/claude-mermaid/live`;

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
  const filePath = `${LIVE_DIR}/${diagramId}/diagram.svg`;

  try {
    const content = await readFile(filePath, "utf-8");
    const html = await createLiveHtmlWrapper(content, diagramId, port, "white");
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  } catch (error) {
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

  if (!diagramId || !diagrams.has(diagramId)) {
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

    const html = await createLiveHtmlWrapper(content, diagramId, port, options.background);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(`Error reading diagram: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function ensureLiveServer(): Promise<number> {
  if (liveServer && liveServerPort) {
    return liveServerPort;
  }

  const port = await findAvailablePort();

  liveServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || "/";

    try {
      if (url.startsWith("/view/")) {
        await handleViewRequest(url, res, port);
        return;
      }

      await handleLivePreviewRequest(url, res, port);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Server error: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  wss = new WebSocketServer({ server: liveServer });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const diagramId = req.url?.substring(1);

    if (diagramId && diagrams.has(diagramId)) {
      const state = diagrams.get(diagramId)!;
      state.clients.add(ws);

      ws.on("close", () => {
        state.clients.delete(ws);
      });
    }
  });

  await new Promise<void>((resolve) => {
    liveServer!.listen(port, () => {
      liveServerPort = port;
      console.error(`Live reload server started on port ${port}`);
      resolve();
    });
  });

  return port;
}

export async function addLiveDiagram(diagramId: string, filePath: string): Promise<void> {
  if (diagrams.has(diagramId)) {
    const existing = diagrams.get(diagramId)!;
    existing.watcher.close();
  }

  const watcher = watch(filePath, (eventType) => {
    if (eventType === "change") {
      notifyClients(diagramId);
    }
  });

  diagrams.set(diagramId, {
    filePath,
    watcher,
    clients: new Set(),
  });
}

export function hasActiveConnections(diagramId: string): boolean {
  const state = diagrams.get(diagramId);
  return state ? state.clients.size > 0 : false;
}

function notifyClients(diagramId: string): void {
  const state = diagrams.get(diagramId);
  if (!state) return;

  state.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send("reload");
    }
  });
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
  background: string = "white"
): Promise<string> {
  const template = await loadTemplate();

  return template
    .replace("{{CONTENT}}", content)
    .replace("{{DIAGRAM_ID}}", diagramId)
    .replace("{{PORT}}", port.toString())
    .replace("{{BACKGROUND}}", background)
    .replace("{{TIMESTAMP}}", new Date().toLocaleTimeString());
}
