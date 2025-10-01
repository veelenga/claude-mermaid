import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleMermaidPreview, handleMermaidSave } from "../src/handlers.js";
import { getPreviewDir, getDiagramFilePath } from "../src/file-utils.js";
import { mkdir, readdir, unlink, rmdir, access, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

// Mock exec to avoid actually running mmdc and create fake output files
vi.mock("child_process", () => ({
  exec: vi.fn((cmd: string, callback: Function) => {
    // Extract output file from command
    const match = cmd.match(/-o "([^"]+)"/);
    if (match) {
      const outputFile = match[1];
      // Create a fake output file
      import("fs/promises").then(({ writeFile }) => {
        writeFile(outputFile, "<svg>test</svg>", "utf-8").then(() => {
          callback(null, { stdout: "", stderr: "" });
        });
      });
    } else {
      callback(null, { stdout: "", stderr: "" });
    }
  }),
}));

// Mock live server functions
vi.mock("../src/live-server.js", () => ({
  ensureLiveServer: vi.fn(async () => 3737),
  addLiveDiagram: vi.fn(async () => {}),
  hasActiveConnections: vi.fn(() => false),
}));

describe("handleMermaidPreview", () => {
  const testPreviewId = "test-preview";
  let testDir: string;

  beforeEach(async () => {
    testDir = getPreviewDir(testPreviewId);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      const files = await readdir(testDir);
      for (const file of files) {
        await unlink(`${testDir}/${file}`);
      }
      await rmdir(testDir);
    } catch {
      // Ignore errors
    }
  });

  it("should throw error when diagram parameter is missing", async () => {
    await expect(
      handleMermaidPreview({
        diagram: undefined,
        preview_id: testPreviewId,
      })
    ).rejects.toThrow("diagram parameter is required");
  });

  it("should throw error when preview_id parameter is missing", async () => {
    await expect(
      handleMermaidPreview({
        diagram: "graph TD; A-->B",
        preview_id: undefined,
      })
    ).rejects.toThrow("preview_id parameter is required");
  });

  it("should use default values when optional parameters are not provided", async () => {
    const result = await handleMermaidPreview({
      diagram: "graph TD; A-->B",
      preview_id: testPreviewId,
    });

    expect(result.isError).toBeUndefined();
  });

  it("should accept all valid parameters", async () => {
    const result = await handleMermaidPreview({
      diagram: "graph TD; A-->B",
      preview_id: testPreviewId,
      format: "svg",
      theme: "dark",
      background: "transparent",
      width: 1024,
      height: 768,
      scale: 3,
    });

    expect(result.isError).toBeUndefined();
  });

  it("should save diagram source and options", async () => {
    await handleMermaidPreview({
      diagram: "graph TD; A-->B",
      preview_id: testPreviewId,
      theme: "dark",
      background: "white",
      width: 800,
      height: 600,
      scale: 2,
    });

    const files = await readdir(testDir);
    expect(files).toContain("diagram.mmd");
    expect(files).toContain("options.json");
  });

  it("should indicate live preview for SVG format", async () => {
    const result = await handleMermaidPreview({
      diagram: "graph TD; A-->B",
      preview_id: testPreviewId,
      format: "svg",
    });

    expect(result.content[0].text).toContain("Live reload");
  });

  it("should indicate static render for PNG format", async () => {
    const result = await handleMermaidPreview({
      diagram: "graph TD; A-->B",
      preview_id: testPreviewId,
      format: "png",
    });

    expect(result.content[0].text).toContain("Live preview is only available for SVG");
  });

  it("should indicate static render for PDF format", async () => {
    const result = await handleMermaidPreview({
      diagram: "graph TD; A-->B",
      preview_id: testPreviewId,
      format: "pdf",
    });

    expect(result.content[0].text).toContain("Live preview is only available for SVG");
  });
});

describe("handleMermaidSave", () => {
  const testPreviewId = "test-save";
  let testDir: string;

  beforeEach(async () => {
    testDir = getPreviewDir(testPreviewId);
    await mkdir(testDir, { recursive: true });

    await handleMermaidPreview({
      diagram: "graph TD; A-->B",
      preview_id: testPreviewId,
      format: "svg",
    });
  });

  afterEach(async () => {
    try {
      const files = await readdir(testDir);
      for (const file of files) {
        await unlink(`${testDir}/${file}`);
      }
      await rmdir(testDir);
    } catch {
      // Ignore errors
    }
  });

  it("should throw error when save_path parameter is missing", async () => {
    await expect(
      handleMermaidSave({
        save_path: undefined,
        preview_id: testPreviewId,
      })
    ).rejects.toThrow("save_path parameter is required");
  });

  it("should throw error when preview_id parameter is missing", async () => {
    await expect(
      handleMermaidSave({
        save_path: "./test.svg",
        preview_id: undefined,
      })
    ).rejects.toThrow("preview_id parameter is required");
  });

  it("should use default format svg", async () => {
    const result = await handleMermaidSave({
      save_path: "/tmp/test-diagram.svg",
      preview_id: testPreviewId,
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("SVG");
  });

  it("should support saving to different formats", async () => {
    const formats = ["svg", "png", "pdf"];

    for (const format of formats) {
      const result = await handleMermaidSave({
        save_path: `/tmp/test-diagram.${format}`,
        preview_id: testPreviewId,
        format,
      });

      expect(result.isError).toBeUndefined();
    }
  });

  it("should re-render if target format does not exist", async () => {
    const result = await handleMermaidSave({
      save_path: "/tmp/test-diagram.png",
      preview_id: testPreviewId,
      format: "png",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("PNG");

    const pngPath = getDiagramFilePath(testPreviewId, "png");
    await access(pngPath);
    await unlink(pngPath);
  });
});
