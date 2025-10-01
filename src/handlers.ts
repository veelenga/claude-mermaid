import { exec } from "child_process";
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
} from "./file-utils.js";

const execAsync = promisify(exec);

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

function getOpenCommand(): string {
  return process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "start"
      : "xdg-open";
}

async function renderDiagram(options: RenderOptions, liveFilePath: string): Promise<void> {
  const { diagram, previewId, format, theme, background, width, height, scale } = options;

  const tempDir = join(tmpdir(), "claude-mermaid");
  await mkdir(tempDir, { recursive: true });

  const inputFile = join(tempDir, `diagram-${previewId}.mmd`);
  const outputFile = join(tempDir, `diagram-${previewId}.${format}`);

  await writeFile(inputFile, diagram, "utf-8");

  const fitFlag = format === "pdf" ? "--pdfFit" : "";
  const cmd = [
    "npx -y mmdc",
    `-i "${inputFile}"`,
    `-o "${outputFile}"`,
    `-t ${theme}`,
    `-b ${background}`,
    `-w ${width}`,
    `-H ${height}`,
    `-s ${scale}`,
    fitFlag,
  ]
    .filter(Boolean)
    .join(" ");

  await execAsync(cmd);
  await copyFile(outputFile, liveFilePath);
}

async function setupLivePreview(
  previewId: string,
  liveFilePath: string,
  format: string
): Promise<{ serverUrl: string; hasConnections: boolean }> {
  const port = await ensureLiveServer();
  const hasConnections = hasActiveConnections(previewId);

  await addLiveDiagram(previewId, liveFilePath);
  const serverUrl = `http://localhost:${port}/${previewId}`;

  if (!hasConnections) {
    const openCommand = getOpenCommand();
    await execAsync(`${openCommand} "${serverUrl}"`);
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
      const { serverUrl, hasConnections } = await setupLivePreview(previewId, liveFilePath, format);
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
