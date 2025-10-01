#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { cleanupOldDiagrams } from "./file-utils.js";
import { handleMermaidPreview, handleMermaidSave } from "./handlers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(await readFile(join(__dirname, "../package.json"), "utf-8"));
const VERSION = packageJson.version;

if (process.argv.includes("-v") || process.argv.includes("--version")) {
  console.log(VERSION);
  process.exit(0);
}

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
          description:
            "ID for this preview session. Use different IDs for multiple diagrams (e.g., 'architecture', 'flow', 'sequence').",
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
          description:
            "Background color for pngs/svgs. Example: transparent, red, '#F0F0F0' (default: white)",
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
          description:
            "ID of the preview to save. Must match the preview_id used in mermaid_preview.",
        },
        format: {
          type: "string",
          enum: ["png", "svg", "pdf"],
          description:
            "Output format (default: svg). Must match the format used in mermaid_preview.",
          default: "svg",
        },
      },
      required: ["save_path", "preview_id"],
    },
  },
];

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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOL_DEFINITIONS };
});

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

async function main() {
  await cleanupOldDiagrams();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Claude Mermaid MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
