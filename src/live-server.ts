import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { watch, FSWatcher } from "fs";
import { readFile } from "fs/promises";

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
    const diagramId = req.url?.substring(1); // Remove leading '/'

    if (!diagramId || !diagrams.has(diagramId)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Diagram not found");
      return;
    }

    const state = diagrams.get(diagramId)!;

    // Read and serve the diagram file
    readFile(state.filePath, "utf-8")
      .then((content) => {
        const html = createLiveHtmlWrapper(content, diagramId, port);
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

function createLiveHtmlWrapper(content: string, diagramId: string, port: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mermaid Diagram Preview (Live)</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
            background: #f5f5f5;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .status-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            padding: 8px 16px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 1000;
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
        .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            max-width: 95vw;
            max-height: 85vh;
            overflow: auto;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-top: 40px;
        }
        svg {
            display: block;
            min-height: 70vh;
            max-height: 85vh;
            width: auto;
            height: auto;
        }
        img {
            display: block;
            min-height: 70vh;
            max-height: 85vh;
            width: auto;
            height: auto;
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
    <div class="container" id="diagram-container">
        ${content}
    </div>
    <script>
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
