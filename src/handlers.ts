import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir, copyFile, access } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { ensureLiveServer, addLiveDiagram, hasActiveConnections } from "./live-server.js";
import {
  getDiagramFilePath,
  getPreviewDir,
  saveDiagramSource,
  loadDiagramSource,
  loadDiagramOptions,
  validateSavePath,
  getOpenCommand,
} from "./file-utils.js";
import { mcpLogger } from "./logger.js";

const execFileAsync = promisify(execFile);

interface RenderOptions {
  diagram: string;
  previewId: string;
  format: string;
  theme: string;
  background: string;
  width: number;
  height: number;
  scale: number;
}

async function renderDiagram(options: RenderOptions, liveFilePath: string): Promise<void> {
  const { diagram, previewId, format, theme, background, width, height, scale } = options;

  mcpLogger.info(`Rendering diagram: ${previewId}`, { format, theme, width, height });

  const tempDir = join(tmpdir(), "claude-mermaid");
  await mkdir(tempDir, { recursive: true });

  const inputFile = join(tempDir, `diagram-${previewId}.mmd`);
  const outputFile = join(tempDir, `diagram-${previewId}.${format}`);

  await writeFile(inputFile, diagram, "utf-8");

  const args = [
    "-y",
    "@mermaid-js/mermaid-cli",
    "-i",
    inputFile,
    "-o",
    outputFile,
    "-t",
    theme,
    "-b",
    background,
    "-w",
    width.toString(),
    "-H",
    height.toString(),
    "-s",
    scale.toString(),
  ];

  if (format === "pdf") {
    args.push("--pdfFit");
  }

  mcpLogger.debug(`Executing mermaid-cli`, { args });

  try {
    const { stdout, stderr } = await execFileAsync("npx", args);
    if (stderr) {
      mcpLogger.debug(`mermaid-cli stderr`, { stderr });
    }
    await copyFile(outputFile, liveFilePath);
    mcpLogger.info(`Diagram rendered successfully: ${previewId}`);
  } catch (error) {
    mcpLogger.error(`Diagram rendering failed: ${previewId}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function setupLivePreview(
  previewId: string,
  liveFilePath: string
): Promise<{ serverUrl: string; hasConnections: boolean }> {
  const port = await ensureLiveServer();
  const hasConnections = hasActiveConnections(previewId);

  await addLiveDiagram(previewId, liveFilePath);
  const serverUrl = `http://localhost:${port}/${previewId}`;

  if (!hasConnections) {
    mcpLogger.info(`Opening browser for new diagram: ${previewId}`, { serverUrl });
    const openCommand = getOpenCommand();
    await execFileAsync(openCommand, [serverUrl]);
  } else {
    mcpLogger.info(`Reusing existing browser tab for diagram: ${previewId}`);
  }

  return { serverUrl, hasConnections };
}

function createLivePreviewResponse(
  liveFilePath: string,
  format: string,
  serverUrl: string,
  hasConnections: boolean
): any {
  const actionMessage = hasConnections
    ? `Mermaid diagram updated successfully.`
    : `Mermaid diagram rendered successfully and opened in browser.`;

  const liveMessage = hasConnections
    ? `\nDiagram updated. Browser will refresh automatically.`
    : `\nLive reload URL: ${serverUrl}\nThe diagram will auto-refresh when you update it.`;

  return {
    content: [
      {
        type: "text",
        text: `${actionMessage}\nWorking file: ${liveFilePath} (${format.toUpperCase()})${liveMessage}`,
      },
    ],
  };
}

function createStaticRenderResponse(liveFilePath: string, format: string): any {
  return {
    content: [
      {
        type: "text",
        text: `Mermaid diagram rendered successfully.\nWorking file: ${liveFilePath} (${format.toUpperCase()})\n\nNote: Live preview is only available for SVG format. Use mermaid_save to save this diagram to a permanent location.`,
      },
    ],
  };
}

export async function handleMermaidPreview(args: any) {
  const diagram = args.diagram as string;
  const previewId = args.preview_id as string;
  const format = (args.format as string) || "svg";
  const theme = (args.theme as string) || "default";
  const background = (args.background as string) || "white";
  const width = (args.width as number) || 800;
  const height = (args.height as number) || 600;
  const scale = (args.scale as number) || 2;

  if (!diagram) {
    throw new Error("diagram parameter is required");
  }
  if (!previewId) {
    throw new Error("preview_id parameter is required");
  }

  const previewDir = getPreviewDir(previewId);
  await mkdir(previewDir, { recursive: true });
  const liveFilePath = getDiagramFilePath(previewId, format);

  try {
    await saveDiagramSource(previewId, diagram, { theme, background, width, height, scale });
    await renderDiagram(
      { diagram, previewId, format, theme, background, width, height, scale },
      liveFilePath
    );

    if (format === "svg") {
      const { serverUrl, hasConnections } = await setupLivePreview(previewId, liveFilePath);
      return createLivePreviewResponse(liveFilePath, format, serverUrl, hasConnections);
    } else {
      return createStaticRenderResponse(liveFilePath, format);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error rendering Mermaid diagram: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

export async function handleMermaidSave(args: any) {
  const savePath = args.save_path as string;
  const previewId = args.preview_id as string;
  const format = (args.format as string) || "svg";

  if (!savePath) {
    throw new Error("save_path parameter is required");
  }
  if (!previewId) {
    throw new Error("preview_id parameter is required");
  }

  // Validate save path to prevent path traversal attacks
  try {
    validateSavePath(savePath);
  } catch (error) {
    mcpLogger.error("Save path validation failed", {
      savePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      content: [
        {
          type: "text",
          text: `Invalid save path: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }

  try {
    const liveFilePath = getDiagramFilePath(previewId, format);

    try {
      await access(liveFilePath);
    } catch {
      const diagram = await loadDiagramSource(previewId);
      const options = await loadDiagramOptions(previewId);
      await renderDiagram(
        {
          diagram,
          previewId,
          format,
          ...options,
        },
        liveFilePath
      );
    }

    const saveDir = dirname(savePath);
    await mkdir(saveDir, { recursive: true });
    await copyFile(liveFilePath, savePath);

    return {
      content: [
        {
          type: "text",
          text: `Diagram saved to: ${savePath} (${format.toUpperCase()})`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error saving diagram: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
