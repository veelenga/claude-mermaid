import { execFile, spawn } from "child_process";
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
  validateFormat,
  validateRenderOptions,
  getOpenCommand,
} from "./file-utils.js";
import { mcpLogger } from "./logger.js";
import type { RenderOptions } from "./types.js";
import { DEFAULT_DIAGRAM_OPTIONS, DEFAULT_FORMAT } from "./constants.js";

const execFileAsync = promisify(execFile);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createErrorResponse(text: string) {
  return { content: [{ type: "text", text }], isError: true };
}

export async function renderDiagram(options: RenderOptions, liveFilePath: string): Promise<void> {
  validateRenderOptions(options);
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
    // On Windows, `execFile`/`spawn` cannot invoke `npx` directly: the real
    // binary is `npx.cmd`, and Node no longer allows direct spawn of `.cmd`
    // files (see CVE-2024-27980 / spawn EINVAL). `{ shell: true }` would work
    // but is deprecated in Node 24+ (DEP0190) because args aren't escaped.
    // The Node-documented pattern is to go through `cmd.exe /c` explicitly.
    // See: https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows
    const isWin = process.platform === "win32";
    const command = isWin ? "cmd.exe" : "npx";
    const finalArgs = isWin ? ["/c", "npx", ...args] : args;
    const { stdout, stderr } = await execFileAsync(command, finalArgs);
    if (stderr) {
      mcpLogger.debug(`mermaid-cli stderr`, { stderr });
    }
    await copyFile(outputFile, liveFilePath);
    mcpLogger.info(`Diagram rendered successfully: ${previewId}`);
  } catch (error) {
    const message = errorMessage(error);
    const stderrValue = error instanceof Error && "stderr" in error ? (error as any).stderr : "";
    const stderr = stderrValue ? `\n${stderrValue}` : "";
    mcpLogger.error(`Diagram rendering failed: ${previewId}`, { error: message });
    throw new Error(`${message}${stderr}`);
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
    const { command, args } = getOpenCommand(serverUrl);
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.on("error", (error) => {
      mcpLogger.warn("Failed to open browser", { error: error.message, serverUrl });
    });
    child.unref();
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
  const format = (args.format as string) ?? DEFAULT_FORMAT;
  const theme = (args.theme as string) ?? DEFAULT_DIAGRAM_OPTIONS.theme;
  const background = (args.background as string) ?? DEFAULT_DIAGRAM_OPTIONS.background;
  const width = (args.width as number) ?? DEFAULT_DIAGRAM_OPTIONS.width;
  const height = (args.height as number) ?? DEFAULT_DIAGRAM_OPTIONS.height;
  const scale = (args.scale as number) ?? DEFAULT_DIAGRAM_OPTIONS.scale;

  if (!diagram) {
    throw new Error("diagram parameter is required");
  }
  if (!previewId) {
    throw new Error("preview_id parameter is required");
  }

  const renderOptions = { diagram, previewId, format, theme, background, width, height, scale };

  try {
    validateRenderOptions(renderOptions);
  } catch (error) {
    return createErrorResponse(errorMessage(error));
  }

  const previewDir = getPreviewDir(previewId);
  await mkdir(previewDir, { recursive: true });
  const liveFilePath = getDiagramFilePath(previewId, format);

  try {
    await saveDiagramSource(previewId, diagram, { theme, background, width, height, scale });
    await renderDiagram(renderOptions, liveFilePath);

    if (format === "svg") {
      const { serverUrl, hasConnections } = await setupLivePreview(previewId, liveFilePath);
      return createLivePreviewResponse(liveFilePath, format, serverUrl, hasConnections);
    } else {
      return createStaticRenderResponse(liveFilePath, format);
    }
  } catch (error) {
    return createErrorResponse(`Error rendering Mermaid diagram: ${errorMessage(error)}`);
  }
}

export async function handleMermaidSave(args: any) {
  const savePath = args.save_path as string;
  const previewId = args.preview_id as string;
  const format = (args.format as string) ?? DEFAULT_FORMAT;

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
      error: errorMessage(error),
    });
    return createErrorResponse(`Invalid save path: ${errorMessage(error)}`);
  }

  try {
    validateFormat(format);
  } catch (error) {
    return createErrorResponse(errorMessage(error));
  }

  try {
    const liveFilePath = getDiagramFilePath(previewId, format);

    try {
      await access(liveFilePath);
    } catch {
      const diagram = await loadDiagramSource(previewId);
      const options = await loadDiagramOptions(previewId);
      await renderDiagram({ ...options, diagram, previewId, format }, liveFilePath);
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
    return createErrorResponse(`Error saving diagram: ${errorMessage(error)}`);
  }
}
