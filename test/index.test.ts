import { describe, it, expect } from "vitest";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  ALLOWED_FORMATS,
  ALLOWED_THEMES,
  DEFAULT_DIAGRAM_OPTIONS,
  DEFAULT_FORMAT,
} from "../src/constants.js";
import { buildToolDefinitions } from "../src/tool-definitions.js";
import { LiveServerPreviewBackend } from "../src/live-preview-backend.js";
import { ArtifactPreviewBackend } from "../src/artifact-preview-backend.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const liveTools = buildToolDefinitions(new LiveServerPreviewBackend());
const preview = liveTools.find((tool) => tool.name === "mermaid_preview")!;
const save = liveTools.find((tool) => tool.name === "mermaid_save")!;
const properties = (tool: typeof preview) => tool.inputSchema.properties as Record<string, any>;

describe("MCP server tool definitions", () => {
  it("defines exactly two tools", () => {
    expect(liveTools.map((tool) => tool.name)).toEqual(["mermaid_preview", "mermaid_save"]);
  });

  describe("mermaid_preview", () => {
    it("requires diagram and preview_id", () => {
      expect(preview.inputSchema.required).toEqual(["diagram", "preview_id"]);
    });

    it("builds format and theme enums from the allowlists", () => {
      expect(properties(preview).format.enum).toEqual([...ALLOWED_FORMATS]);
      expect(properties(preview).theme.enum).toEqual([...ALLOWED_THEMES]);
    });

    it("defines width, height and scale as numbers with defaults", () => {
      for (const key of ["width", "height", "scale"] as const) {
        expect(properties(preview)[key].type).toBe("number");
        expect(properties(preview)[key].default).toBe(DEFAULT_DIAGRAM_OPTIONS[key]);
      }
      expect(properties(preview).format.default).toBe(DEFAULT_FORMAT);
      expect(properties(preview).theme.default).toBe(DEFAULT_DIAGRAM_OPTIONS.theme);
    });

    it("takes its description from the preview backend", () => {
      const artifactTools = buildToolDefinitions(new ArtifactPreviewBackend());
      const artifactPreview = artifactTools.find((tool) => tool.name === "mermaid_preview")!;

      expect(preview.description).toContain(new LiveServerPreviewBackend().toolDescription);
      expect(artifactPreview.description).toContain(new ArtifactPreviewBackend().toolDescription);
      expect(artifactPreview.description).toContain("mermaid_save");
    });
  });

  describe("mermaid_save", () => {
    it("requires save_path and preview_id", () => {
      expect(save.inputSchema.required).toEqual(["save_path", "preview_id"]);
    });

    it("shares the format allowlist with mermaid_preview", () => {
      expect(properties(save).format.enum).toEqual(properties(preview).format.enum);
    });
  });
});

describe("package.json", () => {
  it("should have matching version", async () => {
    const pkg = JSON.parse(await readFile(join(__dirname, "../package.json"), "utf-8"));
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
