import { describe, it, expect } from "vitest";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load tool definitions from the source by parsing the built output
// Since index.ts has top-level await and stdio side effects, we parse package.json
// and validate the tool schema structure against the source file directly.
const indexSource = await readFile(join(__dirname, "../src/index.ts"), "utf-8");

describe("MCP server tool definitions", () => {
  describe("mermaid_preview", () => {
    it("should be defined with correct name", () => {
      expect(indexSource).toContain('name: "mermaid_preview"');
    });

    it("should require diagram and preview_id parameters", () => {
      expect(indexSource).toContain('required: ["diagram", "preview_id"]');
    });

    it("should support format options: png, svg, pdf", () => {
      expect(indexSource).toContain('enum: ["png", "svg", "pdf"]');
    });

    it("should support theme options: default, forest, dark, neutral", () => {
      expect(indexSource).toContain('enum: ["default", "forest", "dark", "neutral"]');
    });

    it("should define width, height, and scale as number parameters", () => {
      // These appear in the properties section for mermaid_preview
      const widthMatch = indexSource.match(/width:\s*\{[^}]*type:\s*"number"/);
      const heightMatch = indexSource.match(/height:\s*\{[^}]*type:\s*"number"/);
      const scaleMatch = indexSource.match(/scale:\s*\{[^}]*type:\s*"number"/);

      expect(widthMatch).not.toBeNull();
      expect(heightMatch).not.toBeNull();
      expect(scaleMatch).not.toBeNull();
    });

    it("should have default values for optional parameters", () => {
      expect(indexSource).toContain('default: "svg"');
      expect(indexSource).toContain('default: "default"');
      expect(indexSource).toContain('default: "white"');
      expect(indexSource).toContain("default: 800");
      expect(indexSource).toContain("default: 600");
      expect(indexSource).toContain("default: 2");
    });
  });

  describe("mermaid_save", () => {
    it("should be defined with correct name", () => {
      expect(indexSource).toContain('name: "mermaid_save"');
    });

    it("should require save_path and preview_id parameters", () => {
      expect(indexSource).toContain('required: ["save_path", "preview_id"]');
    });

    it("should support format options: png, svg, pdf", () => {
      // Both tools share the same format enum
      const formatEnums = indexSource.match(/enum: \["png", "svg", "pdf"\]/g);
      expect(formatEnums).not.toBeNull();
      expect(formatEnums!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("server configuration", () => {
    it("should use claude-mermaid as server name", () => {
      expect(indexSource).toContain('name: "claude-mermaid"');
    });

    it("should define exactly two tools", () => {
      const toolNames = indexSource.match(/name: "mermaid_\w+"/g);
      expect(toolNames).toHaveLength(2);
    });
  });
});

describe("package.json", () => {
  it("should have matching version", async () => {
    const pkg = JSON.parse(await readFile(join(__dirname, "../package.json"), "utf-8"));
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
