import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  ALLOWED_FORMATS,
  ALLOWED_THEMES,
  DEFAULT_FORMAT,
  DEFAULT_DIAGRAM_OPTIONS,
} from "./constants.js";
import type { PreviewBackend } from "./types.js";

export function buildToolDefinitions(previewBackend: PreviewBackend): Tool[] {
  return [
    {
      name: "mermaid_preview",
      description:
        `${previewBackend.toolDescription} ` +
        `Supports themes (${ALLOWED_THEMES.join(", ")}), custom backgrounds, dimensions, and quality scaling. ` +
        "Use mermaid_save to save to disk. " +
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
            enum: [...ALLOWED_FORMATS],
            description: `Output format (default: ${DEFAULT_FORMAT})`,
            default: DEFAULT_FORMAT,
          },
          theme: {
            type: "string",
            enum: [...ALLOWED_THEMES],
            description: `Theme of the chart (default: ${DEFAULT_DIAGRAM_OPTIONS.theme})`,
            default: DEFAULT_DIAGRAM_OPTIONS.theme,
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
            enum: [...ALLOWED_FORMATS],
            description: `Output format (default: ${DEFAULT_FORMAT}). Must match the format used in mermaid_preview.`,
            default: DEFAULT_FORMAT,
          },
        },
        required: ["save_path", "preview_id"],
      },
    },
  ];
}
