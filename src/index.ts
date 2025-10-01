#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir, readFile, copyFile } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { fileURLToPath } from "url";
import { ensureLiveServer, addLiveDiagram, hasActiveConnections } from "./live-server.js";

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
  return {
    tools: [
      {
        name: "render_mermaid",
        description:
          "Render a Mermaid diagram to an image file and open it in the default viewer. " +
          "Takes Mermaid diagram code as input and generates an image (PNG, SVG, or PDF). " +
          "Supports themes (default, forest, dark, neutral), custom backgrounds, dimensions, and quality scaling. " +
          "Can save to project location or temp directory. " +
          "IMPORTANT: Automatically use this tool whenever you create a Mermaid diagram for the user. " +
          "NOTE: Sequence diagrams do not support style directives - avoid using 'style' statements in sequenceDiagram.",
        inputSchema: {
          type: "object",
          properties: {
            diagram: {
              type: "string",
              description: "The Mermaid diagram code to render",
            },
            format: {
              type: "string",
              enum: ["png", "svg", "pdf"],
              description: "Output format (default: svg). For PDF, an SVG preview is shown in browser while PDF is saved to disk.",
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
            save_path: {
              type: "string",
              description: "Optional path to save the diagram file (e.g., './docs/diagram.svg'). If not provided, uses default location in ~/.config/claude-mermaid/",
            },
          },
          required: ["diagram"],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "render_mermaid") {
    const diagram = request.params.arguments?.diagram as string;
    const format = (request.params.arguments?.format as string) || "svg";
    const theme = (request.params.arguments?.theme as string) || "default";
    const background = (request.params.arguments?.background as string) || "white";
    const width = (request.params.arguments?.width as number) || 800;
    const height = (request.params.arguments?.height as number) || 600;
    const scale = (request.params.arguments?.scale as number) || 2;
    let savePath = request.params.arguments?.save_path as string | undefined;

    if (!diagram) {
      throw new Error("diagram parameter is required");
    }

    // If no save path provided, use default location
    if (!savePath) {
      const homeDir = process.env.HOME || process.env.USERPROFILE || tmpdir();
      const configDir = join(homeDir, ".config");
      const liveDir = join(configDir, "claude-mermaid");
      await mkdir(liveDir, { recursive: true });
      savePath = join(liveDir, `live-diagram.${format}`);
    }

    try {
      // Create temp directory for output
      const tempDir = join(tmpdir(), "claude-mermaid");
      await mkdir(tempDir, { recursive: true });

      // Generate stable ID from save path for consistent live reload
      const id = Buffer.from(savePath).toString('base64').replace(/[/+=]/g, '').substring(0, 16);
      const inputFile = join(tempDir, `diagram-${id}.mmd`);

      // For PDF format, we need both PDF (for saving) and SVG (for live preview)
      const outputFile = join(tempDir, `diagram-${id}.${format}`);
      const previewFormat = format === "pdf" ? "svg" : format;
      const previewFile = format === "pdf" ? join(tempDir, `diagram-${id}.${previewFormat}`) : outputFile;

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

      // If PDF format, also generate SVG for live preview
      if (format === "pdf") {
        const previewCmd = [
          'npx -y mmdc',
          `-i "${inputFile}"`,
          `-o "${previewFile}"`,
          `-t ${theme}`,
          `-b ${background}`,
          `-w ${width}`,
          `-H ${height}`,
          `-s ${scale}`
        ].join(' ');
        await execAsync(previewCmd);
      }

      // Copy to save_path if provided
      if (savePath) {
        const saveDir = dirname(savePath);
        await mkdir(saveDir, { recursive: true });
        await copyFile(outputFile, savePath);

        // For PDF format, also save the SVG preview
        if (format === "pdf") {
          const livePreviewPath = savePath.replace(/\.pdf$/, '.svg');
          await copyFile(previewFile, livePreviewPath);
        }
      }

      // Start live server and serve diagram
      const port = await ensureLiveServer();

      // Check if there are active connections before adding the diagram
      const hasConnections = hasActiveConnections(id);

      // For live reload, use the preview file (SVG for PDF format, otherwise the actual file)
      const livePreviewPath = format === "pdf" ? savePath.replace(/\.pdf$/, '.svg') : savePath;
      await addLiveDiagram(id, livePreviewPath);
      const serverUrl = `http://localhost:${port}/${id}`;

      // Only open browser if there are no active connections
      if (!hasConnections) {
        const openCommand = getOpenCommand();
        await execAsync(`${openCommand} "${serverUrl}"`);
      }

      const actionMessage = hasConnections
        ? `Mermaid diagram updated successfully.`
        : `Mermaid diagram rendered successfully and opened in browser.`;

      const formatMessage = format === "pdf"
        ? `\nSaved to: ${savePath}\nLive preview: ${livePreviewPath}`
        : `\nSaved to: ${savePath}`;

      const liveMessage = hasConnections
        ? `\nDiagram updated. Browser will refresh automatically.`
        : `\nLive reload URL: ${serverUrl}\nThe diagram will auto-refresh when you update it.`;

      return {
        content: [
          {
            type: "text",
            text: `${actionMessage}${formatMessage}${liveMessage}`,
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

  throw new Error(`Unknown tool: ${request.params.name}`);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Claude Mermaid MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});