#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir, readFile, copyFile } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { ensureLiveServer, addLiveDiagram, hasActiveConnections } from "./live-server.js";
import { cleanupOldDiagrams, getDiagramFilePath, getLiveDir } from "./file-utils.js";

const execAsync = promisify(exec);

// Read version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(await readFile(join(__dirname, '../package.json'), 'utf-8'));
const VERSION = packageJson.version;

// Check for version flag
if (process.argv.includes('-v') || process.argv.includes('--version')) {
  console.log(VERSION);
  process.exit(0);
}

function getOpenCommand(): string {
  return process.platform === "darwin" ? "open" :
         process.platform === "win32" ? "start" : "xdg-open";
}

// Tool definitions
const TOOL_DEFINITIONS: Tool[] = [
  {
    name: "mermaid_preview",
    description:
      "Render a Mermaid diagram and open it in browser with live reload. " +
      "Takes Mermaid diagram code as input and generates a live preview. " +
      "Supports themes (default, forest, dark, neutral), custom backgrounds, dimensions, and quality scaling. " +
      "The diagram will auto-refresh when updated. Use mermaid_save to save to disk. " +
      "IMPORTANT: Automatically use this tool whenever you create a Mermaid diagram for the user. " +
      "NOTE: Sequence diagrams do not support style directives - avoid using 'style' statements in sequenceDiagram.",
    inputSchema: {
      type: "object",
      properties: {
        diagram: {
          type: "string",
          description: "The Mermaid diagram code to render",
        },
        preview_id: {
          type: "string",
          description: "ID for this preview session. Use different IDs for multiple diagrams (e.g., 'architecture', 'flow', 'sequence').",
        },
        format: {
          type: "string",
          enum: ["png", "svg", "pdf"],
          description: "Output format (default: svg)",
          default: "svg",
        },
        theme: {
          type: "string",
          enum: ["default", "forest", "dark", "neutral"],
          description: "Theme of the chart (default: default)",
          default: "default",
        },
        background: {
          type: "string",
          description: "Background color for pngs/svgs. Example: transparent, red, '#F0F0F0' (default: white)",
          default: "white",
        },
        width: {
          type: "number",
          description: "Diagram width in pixels (default: 800)",
          default: 800,
        },
        height: {
          type: "number",
          description: "Diagram height in pixels (default: 600)",
          default: 600,
        },
        scale: {
          type: "number",
          description: "Scale factor for higher quality output (default: 2)",
          default: 2,
        },
      },
      required: ["diagram", "preview_id"],
    },
  },
  {
    name: "mermaid_save",
    description:
      "Save the current live Mermaid diagram to a file path. " +
      "This copies the already-rendered diagram from the live preview to the specified location. " +
      "Use this after tuning your diagram with mermaid_preview.",
    inputSchema: {
      type: "object",
      properties: {
        save_path: {
          type: "string",
          description: "Path to save the diagram file (e.g., './docs/diagram.svg')",
        },
        preview_id: {
          type: "string",
          description: "ID of the preview to save. Must match the preview_id used in mermaid_preview.",
        },
        format: {
          type: "string",
          enum: ["png", "svg", "pdf"],
          description: "Output format (default: svg). Must match the format used in mermaid_preview.",
          default: "svg",
        },
      },
      required: ["save_path", "preview_id"],
    },
  },
];

// Handler for mermaid_preview tool
async function handleMermaidPreview(args: any) {
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
      'npx -y mmdc',
      `-i "${inputFile}"`,
      `-o "${outputFile}"`,
      `-t ${theme}`,
      `-b ${background}`,
      `-w ${width}`,
      `-H ${height}`,
      `-s ${scale}`,
      fitFlag
    ].filter(Boolean).join(' ');

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

// Handler for mermaid_save tool
async function handleMermaidSave(args: any) {
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

const server = new Server(
  {
    name: "claude-mermaid",
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOL_DEFINITIONS };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "mermaid_preview":
      return await handleMermaidPreview(request.params.arguments);
    case "mermaid_save":
      return await handleMermaidSave(request.params.arguments);
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

// Start the server
async function main() {
  // Clean up old diagram files on startup
  await cleanupOldDiagrams();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Claude Mermaid MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});