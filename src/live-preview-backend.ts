import { spawn } from "child_process";
import { ensureLiveServer, addLiveDiagram, hasActiveConnections } from "./live-server.js";
import { getOpenCommand } from "./file-utils.js";
import { mcpLogger } from "./logger.js";
import type { PreviewBackend, PreviewRequest } from "./types.js";

function openBrowser(previewId: string, serverUrl: string): void {
  mcpLogger.info(`Opening browser for new diagram: ${previewId}`, { serverUrl });
  const { command, args } = getOpenCommand(serverUrl);
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.on("error", (error) => {
    mcpLogger.warn("Failed to open browser", { error: error.message, serverUrl });
  });
  child.unref();
}

export class LiveServerPreviewBackend implements PreviewBackend {
  readonly toolDescription =
    "Render a Mermaid diagram and open it in browser with live reload. " +
    "Takes Mermaid diagram code as input and generates a live preview. " +
    "The diagram will auto-refresh when updated.";

  async present({ previewId, filePath }: PreviewRequest): Promise<string> {
    const port = await ensureLiveServer();
    const hasConnections = hasActiveConnections(previewId);

    await addLiveDiagram(previewId, filePath);
    const serverUrl = `http://localhost:${port}/${previewId}`;

    if (hasConnections) {
      mcpLogger.info(`Reusing existing browser tab for diagram: ${previewId}`);
    } else {
      openBrowser(previewId, serverUrl);
    }

    return this.describe(filePath, serverUrl, hasConnections);
  }

  private describe(filePath: string, serverUrl: string, hasConnections: boolean): string {
    const actionMessage = hasConnections
      ? "Mermaid diagram updated successfully."
      : "Mermaid diagram rendered successfully and opened in browser.";

    const liveMessage = hasConnections
      ? "\nDiagram updated. Browser will refresh automatically."
      : `\nLive reload URL: ${serverUrl}\nThe diagram will auto-refresh when you update it.`;

    return `${actionMessage}\nWorking file: ${filePath} (SVG)${liveMessage}`;
  }
}
