import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir, copyFile } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { ensureLiveServer, addLiveDiagram, hasActiveConnections } from "./live-server.js";
import { getDiagramFilePath, getLiveDir } from "./file-utils.js";

const execAsync = promisify(exec);

function getOpenCommand(): string {
  return process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "start"
      : "xdg-open";
}

/**
 * Handler for mermaid_preview tool
 */
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

  // Get live directory and file path
  const liveDir = getLiveDir();
  await mkdir(liveDir, { recursive: true });
  const liveFilePath = getDiagramFilePath(previewId, format);

  try {
    // Create temp directory for output
    const tempDir = join(tmpdir(), "claude-mermaid");
    await mkdir(tempDir, { recursive: true });

    const inputFile = join(tempDir, `diagram-${previewId}.mmd`);
    const outputFile = join(tempDir, `diagram-${previewId}.${format}`);

    // Write diagram to temp file
    await writeFile(inputFile, diagram, "utf-8");

    // Build mermaid CLI command with all parameters
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

    // Save to live directory for live reload
    await copyFile(outputFile, liveFilePath);

    // Start live server and serve diagram
    const port = await ensureLiveServer();

    // Check if there are active connections before adding the diagram
    const hasConnections = hasActiveConnections(previewId);

    await addLiveDiagram(previewId, liveFilePath, format);
    const serverUrl = `http://localhost:${port}/${previewId}`;

    // Only open browser if there are no active connections
    if (!hasConnections) {
      const openCommand = getOpenCommand();
      await execAsync(`${openCommand} "${serverUrl}"`);
    }

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

/**
 * Handler for mermaid_save tool
 */
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
    // Get the live diagram file path
    const liveFilePath = getDiagramFilePath(previewId, format);

    // Create save directory if needed
    const saveDir = dirname(savePath);
    await mkdir(saveDir, { recursive: true });

    // Copy live file to save path
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
