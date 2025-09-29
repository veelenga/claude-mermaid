#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

const execAsync = promisify(exec);

const server = new Server(
  {
    name: "claude-mermaid",
    version: "1.0.0",
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
        name: "preview_mermaid",
        description:
          "Render a Mermaid diagram to an image file and open it in the default browser. " +
          "Takes Mermaid diagram code as input and generates a PNG image. " +
          "IMPORTANT: Automatically use this tool whenever you create a Mermaid diagram for the user.",
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
              description: "Output format (default: png)",
              default: "png",
            },
            browser: {
              type: "boolean",
              description: "Wrap the diagram in an HTML page for browser viewing (default: false)",
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
  if (request.params.name === "preview_mermaid") {
    const diagram = request.params.arguments?.diagram as string;
    const format = (request.params.arguments?.format as string) || "png";
    const browser = (request.params.arguments?.browser as boolean) || false;

    if (!diagram) {
      throw new Error("diagram parameter is required");
    }

    try {
      // Create temp directory for output
      const tempDir = join(tmpdir(), "claude-mermaid");
      await mkdir(tempDir, { recursive: true });

      // Generate unique filename
      const id = randomBytes(8).toString("hex");
      const inputFile = join(tempDir, `diagram-${id}.mmd`);
      const outputFile = join(tempDir, `diagram-${id}.${format}`);

      // Write diagram to temp file
      await writeFile(inputFile, diagram, "utf-8");

      // Run mermaid CLI to render diagram
      await execAsync(`npx -y mmdc -i "${inputFile}" -o "${outputFile}"`);

      let fileToOpen = outputFile;

      // If browser mode, create HTML wrapper
      if (browser) {
        const htmlFile = join(tempDir, `diagram-${id}.html`);
        const isImage = format === "png" || format === "svg";
        const htmlContent = `<!DOCTYPE html>
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
            max-width: 100%;
        }
        img, object {
            max-width: 100%;
            height: auto;
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        ${format === "svg"
          ? `<object type="image/svg+xml" data="diagram-${id}.svg"></object>`
          : format === "png"
          ? `<img src="diagram-${id}.png" alt="Mermaid Diagram">`
          : `<embed src="diagram-${id}.pdf" type="application/pdf" width="800" height="600">`
        }
    </div>
</body>
</html>`;
        await writeFile(htmlFile, htmlContent, "utf-8");
        fileToOpen = htmlFile;
      }

      // Open in default browser/viewer
      const openCommand = process.platform === "darwin" ? "open" :
                          process.platform === "win32" ? "start" : "xdg-open";
      await execAsync(`${openCommand} "${fileToOpen}"`);

      return {
        content: [
          {
            type: "text",
            text: `Mermaid diagram rendered successfully and opened in ${browser ? "browser" : "default viewer"}.\nOutput file: ${fileToOpen}`,
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