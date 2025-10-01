import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { watch, FSWatcher } from "fs";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { loadDiagramOptions } from "./file-utils.js";

const CONFIG_DIR = process.env.XDG_CONFIG_HOME || `${homedir()}/.config`;
const LIVE_DIR = `${CONFIG_DIR}/claude-mermaid/live`;

// Live reload server state
interface DiagramState {
  filePath: string;
  watcher: FSWatcher;
  clients: Set<WebSocket>;
}

let liveServer: HttpServer | null = null;
let liveServerPort: number | null = null;
let wss: WebSocketServer | null = null;
const diagrams = new Map<string, DiagramState>(); // diagramId -> state

// Find available port starting from 3737
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

// Start live reload server if not already running
export async function ensureLiveServer(): Promise<number> {
  if (liveServer && liveServerPort) {
    return liveServerPort;
  }

  const port = await findAvailablePort();

  liveServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || "/";

    // Test endpoint with file from live storage
    if (url.startsWith("/file/")) {
      const fileName = url.substring(6); // Remove '/file/'
      const filePath = `${LIVE_DIR}/${fileName}/diagram.svg`;

      readFile(filePath, "utf-8")
        .then((content) => {
          const html = createLiveHtmlWrapper(content, fileName, port, "white");
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(html);
        })
        .catch((error) => {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end(`Error reading file: ${error.message}`);
        });
      return;
    }

    const diagramId = url.substring(1); // Remove leading '/'

    if (!diagramId || !diagrams.has(diagramId)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Diagram not found");
      return;
    }

    const state = diagrams.get(diagramId)!;

    Promise.all([readFile(state.filePath, "utf-8"), loadDiagramOptions(diagramId)])
      .then(([content, options]) => {
        const html = createLiveHtmlWrapper(content, diagramId, port, options.background);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
      })
      .catch((error) => {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(`Error reading diagram: ${error.message}`);
      });
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

// Add or update a diagram in live mode
export async function addLiveDiagram(
  diagramId: string,
  filePath: string,
  format: string = "svg"
): Promise<void> {
  // Clean up existing watcher if any
  if (diagrams.has(diagramId)) {
    const existing = diagrams.get(diagramId)!;
    existing.watcher.close();
  }

  // Create file watcher
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

// Check if there are active connections viewing this diagram
export function hasActiveConnections(diagramId: string): boolean {
  const state = diagrams.get(diagramId);
  return state ? state.clients.size > 0 : false;
}

// Notify all connected clients for a diagram to reload
function notifyClients(diagramId: string): void {
  const state = diagrams.get(diagramId);
  if (!state) return;

  state.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send("reload");
    }
  });
}

function createLiveHtmlWrapper(
  content: string,
  diagramId: string,
  port: number,
  background: string = "white"
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mermaid Diagram Preview (Live)</title>
    <style>
        * {
            box-sizing: border-box;
        }
        body {
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            background: #1a1a1a;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .status-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            padding: 8px 16px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 1000;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #4CAF50;
            margin-right: 8px;
            display: inline-block;
        }
        .status-indicator.disconnected {
            background: #f44336;
        }
        .viewport {
            position: fixed;
            top: 32px;
            left: 0;
            right: 0;
            bottom: 0;
            overflow: auto;
            background: ${background};
        }
        .diagram-wrapper {
            width: 100%;
            min-height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px;
        }
        #diagram-container {
            display: block;
            width: 100%;
        }
        svg {
            display: block;
            height: auto !important;
            width: auto !important;
            max-width: 100% !important;
            margin: 0 auto;
        }
        svg.tall {
            width: 70% !important;
        }
        svg.square {
            width: 50% !important;
        }
        svg.wide {
            width: 100% !important;
        }
    </style>
</head>
<body>
    <div class="status-bar">
        <div>
            <span class="status-indicator" id="status-indicator"></span>
            <span id="status-text">Live Reload Active</span>
        </div>
        <div id="last-update">Last updated: ${new Date().toLocaleTimeString()}</div>
    </div>

    <div class="viewport">
        <div class="diagram-wrapper">
            <div id="diagram-container">
                ${content}
            </div>
        </div>
    </div>

    <script>
        // Auto-scale diagram based on viewport
        function scaleDiagram() {
            const svg = document.querySelector('svg');
            if (!svg) return;

            const viewBox = svg.getAttribute('viewBox');
            if (!viewBox) return;

            const [, , width, height] = viewBox.split(' ').map(Number);
            const ratio = width / height;

            // Remove all classes first
            svg.classList.remove('tall', 'square', 'wide');

            // 1. Tall diagrams
            if (ratio < 0.7) {
                svg.classList.add('tall');
            }
            // 2. Square-ish diagrams
            else if (ratio >= 0.7 && ratio <= 1.5) {
                svg.classList.add('square');
            }
            // 3. Wide diagrams
            else {
                svg.classList.add('wide');
            }
        }

        // Scale on load and resize
        window.addEventListener('load', scaleDiagram);
        window.addEventListener('resize', scaleDiagram);
        scaleDiagram();

        let ws;
        let reconnectInterval;

        function connect() {
            ws = new WebSocket('ws://localhost:${port}/${diagramId}');

            ws.onopen = () => {
                console.log('WebSocket connected');
                document.getElementById('status-text').textContent = 'Live Reload Active';
                document.getElementById('status-indicator').classList.remove('disconnected');
                if (reconnectInterval) {
                    clearInterval(reconnectInterval);
                    reconnectInterval = null;
                }
            };

            ws.onmessage = (event) => {
                if (event.data === 'reload') {
                    console.log('Reloading diagram...');
                    location.reload();
                }
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                document.getElementById('status-text').textContent = 'Disconnected - Reconnecting...';
                document.getElementById('status-indicator').classList.add('disconnected');

                if (!reconnectInterval) {
                    reconnectInterval = setInterval(() => {
                        console.log('Attempting to reconnect...');
                        connect();
                    }, 2000);
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                ws.close();
            };
        }

        connect();
    </script>
</body>
</html>`;
}
