import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleMermaidPreview, handleMermaidSave } from "../src/handlers.js";
import { getPreviewDir, getDiagramFilePath } from "../src/file-utils.js";
import { readdir, unlink, access } from "fs/promises";
import { execFile } from "child_process";
import { execPath } from "process";
import { setupTestEnvWithPreview, restoreTestEnv } from "./helpers/env-helpers.js";

// Partial mock of fs/promises so access() resolves for npx-cli.js discovery
// regardless of the host Node install layout (keeps the win32 test hermetic).
vi.mock("fs/promises", async () => {
  const actual = await vi.importActual<typeof import("fs/promises")>("fs/promises");
  return {
    ...actual,
    access: vi.fn((path: any, mode?: any) => {
      if (typeof path === "string" && path.endsWith("npx-cli.js")) {
        return Promise.resolve();
      }
      return actual.access(path, mode);
    }),
  };
});

// Mock child_process to avoid actually running mmdc and opening browser
vi.mock("child_process", () => ({
  execFile: vi.fn((_file: string, args: string[], callback: Function) => {
    const outputIndex = args.indexOf("-o");
    if (outputIndex !== -1 && outputIndex + 1 < args.length) {
      const outputFile = args[outputIndex + 1];
      const fs = require("fs");
      const path = require("path");
      const dir = path.dirname(outputFile);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const ext = path.extname(outputFile);
      if (ext === ".svg") {
        fs.writeFileSync(outputFile, "<svg>test</svg>", "utf-8");
      } else if (ext === ".png") {
        fs.writeFileSync(outputFile, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      } else if (ext === ".pdf") {
        fs.writeFileSync(outputFile, "%PDF-1.4\n", "utf-8");
      } else {
        fs.writeFileSync(outputFile, "test", "utf-8");
      }

      callback(null, { stdout: "", stderr: "" });
    } else {
      callback(null, { stdout: "", stderr: "" });
    }
  }),
  spawn: vi.fn(() => ({
    unref: vi.fn(),
    on: vi.fn(),
  })),
}));

vi.mock("../src/live-server.js", () => ({
  ensureLiveServer: vi.fn(async () => 3737),
  addLiveDiagram: vi.fn(async () => {}),
  hasActiveConnections: vi.fn(() => false),
}));

describe("handleMermaidPreview", () => {
  const testPreviewId = "test-preview";
  let testDir: string;

  beforeEach(async () => {
    testDir = await setupTestEnvWithPreview(testPreviewId);
  });

  afterEach(async () => {
    await restoreTestEnv();
  });

  it("should throw error when diagram parameter is missing", async () => {
    await expect(
      handleMermaidPreview({ diagram: undefined, preview_id: testPreviewId })
    ).rejects.toThrow("diagram parameter is required");
  });

  it("should throw error when preview_id parameter is missing", async () => {
    await expect(
      handleMermaidPreview({ diagram: "graph TD; A-->B", preview_id: undefined })
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

  it("should include stderr details in error when rendering fails", async () => {
    const mockExecFile = vi.mocked(execFile);
    mockExecFile.mockImplementationOnce((_file: string, _args: any, callback: any) => {
      const error: any = new Error("Command failed: npx mmdc");
      error.stderr = "Parse error on line 3: invalid syntax near 'graph'";
      callback(error, { stdout: "", stderr: error.stderr });
    });

    const result = await handleMermaidPreview({
      diagram: "invalid diagram syntax",
      preview_id: testPreviewId,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Parse error on line 3");
    expect(result.content[0].text).toContain("Command failed");
  });

  it("should invoke node directly with npx-cli.js on win32", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    const mockExecFile = vi.mocked(execFile);
    mockExecFile.mockClear();

    try {
      await handleMermaidPreview({
        diagram: "graph TD; A-->B",
        preview_id: testPreviewId,
      });

      expect(mockExecFile).toHaveBeenCalled();
      const [file, args] = mockExecFile.mock.calls[0] as [string, string[], unknown];
      expect(file).toBe(execPath);
      expect(file).not.toBe("npx");
      expect(Array.isArray(args)).toBe(true);
      expect(args[0]).toContain("npx-cli.js");
    } finally {
      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        configurable: true,
      });
    }
  });

  it("should invoke npx directly on non-win32 platforms", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    const mockExecFile = vi.mocked(execFile);
    mockExecFile.mockClear();

    try {
      await handleMermaidPreview({
        diagram: "graph TD; A-->B",
        preview_id: testPreviewId,
      });

      expect(mockExecFile).toHaveBeenCalled();
      const [file, args] = mockExecFile.mock.calls[0] as [string, string[], unknown];
      expect(file).toBe("npx");
      expect(args[0]).not.toContain("npx-cli.js");
    } finally {
      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        configurable: true,
      });
    }
  });

  it("should show original error message when stderr is empty", async () => {
    const mockExecFile = vi.mocked(execFile);
    mockExecFile.mockImplementationOnce((_file: string, _args: any, callback: any) => {
      const error = new Error("Command failed: npx mmdc");
      callback(error, { stdout: "", stderr: "" });
    });

    const result = await handleMermaidPreview({
      diagram: "invalid diagram syntax",
      preview_id: testPreviewId,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Command failed");
  });
});

describe("handleMermaidSave", () => {
  const testPreviewId = "test-save";

  beforeEach(async () => {
    await setupTestEnvWithPreview(testPreviewId);

    await handleMermaidPreview({
      diagram: "graph TD; A-->B",
      preview_id: testPreviewId,
      format: "svg",
    });
  });

  afterEach(async () => {
    await restoreTestEnv();
  });

  it("should throw error when save_path parameter is missing", async () => {
    await expect(
      handleMermaidSave({ save_path: undefined, preview_id: testPreviewId })
    ).rejects.toThrow("save_path parameter is required");
  });

  it("should throw error when preview_id parameter is missing", async () => {
    await expect(
      handleMermaidSave({ save_path: "./test.svg", preview_id: undefined })
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

  it("should handle missing diagram source when saving", async () => {
    const result = await handleMermaidSave({
      save_path: "/tmp/test-diagram.svg",
      preview_id: "non-existent-preview",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error saving diagram");
  });
});
