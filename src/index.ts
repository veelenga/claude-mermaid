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

export function getOpenCommand(): string {
  return process.platform === "darwin" ? "open" :
         process.platform === "win32" ? "start" : "xdg-open";
}

export function createHtmlWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mermaid Diagram Preview</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #f5f5f5;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
    <div class="container">
        ${content}
    </div>
</body>
</html>`;
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
              description: "Output format (default: svg)",
              default: "svg",
            },
            browser: {
              type: "boolean",
              description: "Wrap the diagram in an HTML page for browser viewing (default: false)",
              default: false,
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
              description: "Optional path to save the diagram file (e.g., './docs/diagram.svg'). If not provided, uses temp directory.",
            },
            live: {
              type: "boolean",
              description: "Enable live reload mode with automatic refresh when diagram changes. Starts a local server and watches for file changes. Requires save_path or uses default location. Only works with browser mode (automatically enabled).",
              default: false,
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
    let browser = (request.params.arguments?.browser as boolean) || false;
    const theme = (request.params.arguments?.theme as string) || "default";
    const background = (request.params.arguments?.background as string) || "white";
    const width = (request.params.arguments?.width as number) || 800;
    const height = (request.params.arguments?.height as number) || 600;
    const scale = (request.params.arguments?.scale as number) || 2;
    let savePath = request.params.arguments?.save_path as string | undefined;
    const live = (request.params.arguments?.live as boolean) || false;

    if (!diagram) {
      throw new Error("diagram parameter is required");
    }

    // Live mode requires SVG or PNG format
    if (live && format === "pdf") {
      throw new Error("Live mode is not supported with PDF format. Use SVG or PNG instead.");
    }

    // Live mode automatically enables browser mode
    if (live) {
      browser = true;

      // If no save path provided, use default location
      if (!savePath) {
        const homeDir = process.env.HOME || process.env.USERPROFILE || tmpdir();
        const liveDir = join(homeDir, ".claude-mermaid");
        await mkdir(liveDir, { recursive: true });
        savePath = join(liveDir, `live-diagram.${format}`);
      }
    }

    try {
      // Create temp directory for output
      const tempDir = join(tmpdir(), "claude-mermaid");
      await mkdir(tempDir, { recursive: true });

      // Generate unique filename (or use hash of save path for live mode)
      const id = live && savePath
        ? Buffer.from(savePath).toString('base64').replace(/[/+=]/g, '').substring(0, 16)
        : randomBytes(8).toString("hex");
      const inputFile = join(tempDir, `diagram-${id}.mmd`);
      const outputFile = join(tempDir, `diagram-${id}.${format}`);

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

      // Copy to save_path if provided
      if (savePath) {
        const saveDir = dirname(savePath);
        await mkdir(saveDir, { recursive: true });
        await copyFile(outputFile, savePath);
      }

      let fileToOpen: string;
      let serverUrl: string | null = null;
      let shouldOpenBrowser = false;

      // Handle live mode with server
      if (live && savePath) {
        const port = await ensureLiveServer();

        // Check if there are active connections before adding the diagram
        const hasConnections = hasActiveConnections(id);

        await addLiveDiagram(id, savePath);
        serverUrl = `http://localhost:${port}/${id}`;
        fileToOpen = serverUrl;

        // Only open browser if there are no active connections
        if (!hasConnections) {
          const openCommand = getOpenCommand();
          await execAsync(`${openCommand} "${serverUrl}"`);
          shouldOpenBrowser = true;
        }
      } else {
        fileToOpen = outputFile;

        // If browser mode, create HTML wrapper (only for PNG and SVG)
        if (browser && (format === "png" || format === "svg")) {
          const htmlFile = join(tempDir, `diagram-${id}.html`);
          let imageTag: string;

          if (format === "svg") {
            const svgContent = await readFile(outputFile, "utf-8");
            imageTag = svgContent;
          } else {
            const pngBuffer = await readFile(outputFile);
            imageTag = `<img src="data:image/png;base64,${pngBuffer.toString("base64")}" alt="Mermaid Diagram">`;
          }

          const htmlContent = createHtmlWrapper(imageTag);
          await writeFile(htmlFile, htmlContent, "utf-8");
          fileToOpen = htmlFile;
        }

        // Open in default browser/viewer
        const openCommand = getOpenCommand();
        await execAsync(`${openCommand} "${fileToOpen}"`);
      }

      const savedMessage = savePath ? `\nSaved to: ${savePath}` : '';
      let liveMessage = '';
      if (live) {
        if (shouldOpenBrowser) {
          liveMessage = `\nLive reload URL: ${serverUrl}\nThe diagram will auto-refresh when you update it.`;
        } else {
          liveMessage = `\nDiagram updated. Browser will refresh automatically.`;
        }
      }

      const actionMessage = live && !shouldOpenBrowser
        ? `Mermaid diagram updated successfully.`
        : `Mermaid diagram rendered successfully and opened in ${browser ? "browser" : "default viewer"}.`;

      return {
        content: [
          {
            type: "text",
            text: `${actionMessage}\nOutput file: ${fileToOpen}${savedMessage}${liveMessage}`,
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