#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { handleMermaidPreview, handleMermaidSave } from "./handlers.js";
import { buildToolDefinitions } from "./tool-definitions.js";
import { parseCliOptions } from "./cli.js";
import { createPreviewBackend, resolvePreviewBackendName } from "./preview-backend.js";
import { mcpLogger } from "./logger.js";
import type { PreviewBackend } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(await readFile(join(__dirname, "../package.json"), "utf-8"));
const VERSION = packageJson.version;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createMcpServer(previewBackend: PreviewBackend): Server {
  const server = new Server(
    { name: "claude-mermaid", version: VERSION },
    { capabilities: { tools: {} } }
  );
  const tools = buildToolDefinitions(previewBackend);

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    mcpLogger.debug("ListTools request received");
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = request.params.arguments;

    mcpLogger.info(`CallTool request: ${toolName}`);

    try {
      let result;
      switch (toolName) {
        case "mermaid_preview":
          result = await handleMermaidPreview(args, previewBackend);
          mcpLogger.info(`CallTool completed: ${toolName}`);
          return result;
        case "mermaid_save":
          result = await handleMermaidSave(args);
          mcpLogger.info(`CallTool completed: ${toolName}`);
          return result;
        default:
          mcpLogger.error(`Unknown tool: ${toolName}`);
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      mcpLogger.error(`Tool ${toolName} failed`, { error: errorMessage(error) });
      throw error;
    }
  });

  return server;
}

async function startMcpServer(previewBackend: PreviewBackend): Promise<void> {
  mcpLogger.info("MCP Server starting", { version: VERSION });

  const transport = new StdioServerTransport();
  await createMcpServer(previewBackend).connect(transport);
  mcpLogger.info("MCP Server connected via stdio");
  console.error("Claude Mermaid MCP Server running on stdio");
}

async function run(): Promise<void> {
  const options = parseCliOptions();

  if (options.version) {
    console.log(VERSION);
    return;
  }

  if (options.serve) {
    const { startServeMode } = await import("./serve.js");
    await startServeMode();
    return;
  }

  const previewBackend = createPreviewBackend(resolvePreviewBackendName(options.preview));
  await startMcpServer(previewBackend);
}

run().catch((error) => {
  mcpLogger.error("Fatal error during startup", {
    error: errorMessage(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  console.error(`Fatal error: ${errorMessage(error)}`);
  process.exit(1);
});
