import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from "vitest";
import {
  getLiveDir,
  getPreviewDir,
  getDiagramFilePath,
  getDiagramSourcePath,
  getDiagramOptionsPath,
  saveDiagramSource,
  loadDiagramSource,
  loadDiagramOptions,
  getConfigDir,
  validateSavePath,
} from "../src/file-utils.js";
import { unlink, mkdir, rmdir, readdir, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { setupTestEnv, restoreTestEnv } from "./helpers/env-helpers.js";

describe("File Utilities", () => {
  beforeAll(async () => {
    await setupTestEnv();
  });

  afterAll(async () => {
    await restoreTestEnv();
  });
  describe("getLiveDir", () => {
    it("should return path containing .config/claude-mermaid/live", () => {
      const liveDir = getLiveDir();
      expect(liveDir).toContain(".config");
      expect(liveDir).toContain("claude-mermaid");
      expect(liveDir).toContain("live");
    });

    it("should return consistent path on multiple calls", () => {
      const path1 = getLiveDir();
      const path2 = getLiveDir();
      expect(path1).toBe(path2);
    });

    it("should derive from config dir based on env", () => {
      const liveDir = getLiveDir();
      const homeDir = process.env.HOME || process.env.USERPROFILE || tmpdir();
      const expectedRoot = process.env.XDG_CONFIG_HOME || join(homeDir, ".config");
      expect(liveDir).toContain(expectedRoot);
    });
  });

  describe("getPreviewDir", () => {
    it("should return path with preview_id subdirectory", () => {
      const previewDir = getPreviewDir("architecture");
      expect(previewDir).toContain(".config/claude-mermaid/live");
      expect(previewDir).toContain("architecture");
    });

    it("should support different preview_ids", () => {
      const archDir = getPreviewDir("architecture");
      const flowDir = getPreviewDir("flow");

      expect(archDir).toContain("architecture");
      expect(flowDir).toContain("flow");
      expect(archDir).not.toBe(flowDir);
    });

    describe("previewId validation", () => {
      it("should accept valid alphanumeric IDs", () => {
        expect(() => getPreviewDir("diagram123")).not.toThrow();
        expect(() => getPreviewDir("flow-chart")).not.toThrow();
        expect(() => getPreviewDir("my_diagram")).not.toThrow();
        expect(() => getPreviewDir("Diagram-123_test")).not.toThrow();
      });

      it("should reject empty or whitespace-only IDs", () => {
        expect(() => getPreviewDir("")).toThrow("Invalid preview ID format");
        expect(() => getPreviewDir("   ")).toThrow("Invalid preview ID format");
      });

      it("should reject path traversal attempts", () => {
        expect(() => getPreviewDir("../etc/passwd")).toThrow("Invalid preview ID format");
        expect(() => getPreviewDir("..")).toThrow("Invalid preview ID format");
        expect(() => getPreviewDir("foo/../bar")).toThrow("Invalid preview ID format");
      });

      it("should reject absolute paths", () => {
        expect(() => getPreviewDir("/etc/passwd")).toThrow("Invalid preview ID format");
        expect(() => getPreviewDir("/tmp/diagram")).toThrow("Invalid preview ID format");
      });

      it("should reject IDs with path separators", () => {
        expect(() => getPreviewDir("foo/bar")).toThrow("Invalid preview ID format");
        expect(() => getPreviewDir("foo\\bar")).toThrow("Invalid preview ID format");
      });

      it("should reject IDs with special characters", () => {
        expect(() => getPreviewDir("diagram@123")).toThrow("Invalid preview ID format");
        expect(() => getPreviewDir("test$diagram")).toThrow("Invalid preview ID format");
        expect(() => getPreviewDir("my diagram")).toThrow("Invalid preview ID format");
        expect(() => getPreviewDir("test;ls")).toThrow("Invalid preview ID format");
      });

      it("should reject IDs with null bytes", () => {
        expect(() => getPreviewDir("test\0diagram")).toThrow("Invalid preview ID format");
      });

      it("should reject IDs starting with dot", () => {
        expect(() => getPreviewDir(".hidden")).toThrow("Invalid preview ID format");
        expect(() => getPreviewDir("..secret")).toThrow("Invalid preview ID format");
      });
    });
  });

  describe("getConfigDir precedence", () => {
    let originalXdg: string | undefined;
    let originalHomeLocal: string | undefined;

    beforeEach(() => {
      originalXdg = process.env.XDG_CONFIG_HOME;
      originalHomeLocal = process.env.HOME;
    });

    afterEach(() => {
      if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = originalXdg;

      if (originalHomeLocal === undefined) delete process.env.HOME;
      else process.env.HOME = originalHomeLocal;
    });

    it("should prefer XDG_CONFIG_HOME when set", async () => {
      const xdgDir = await mkdtemp(join(tmpdir(), "claude-mermaid-xdg-"));
      process.env.XDG_CONFIG_HOME = xdgDir;

      const cfg = getConfigDir();
      expect(cfg).toBe(xdgDir);

      const live = getLiveDir();
      expect(live).toBe(join(xdgDir, "claude-mermaid", "live"));
    });

    it("should fallback to HOME/.config when XDG unset", async () => {
      delete process.env.XDG_CONFIG_HOME;
      const tempHome = await mkdtemp(join(tmpdir(), "claude-mermaid-home-"));
      process.env.HOME = tempHome;

      const cfg = getConfigDir();
      expect(cfg).toBe(join(tempHome, ".config"));

      const live = getLiveDir();
      expect(live).toBe(join(cfg, "claude-mermaid", "live"));
    });
  });

  describe("getDiagramFilePath", () => {
    it("should generate correct file path with preview_id and format", () => {
      const filePath = getDiagramFilePath("architecture", "svg");
      expect(filePath).toContain("architecture");
      expect(filePath).toContain("diagram.svg");
      expect(filePath).toContain(".config/claude-mermaid/live");
    });

    it("should support different formats", () => {
      const svgPath = getDiagramFilePath("test", "svg");
      const pngPath = getDiagramFilePath("test", "png");
      const pdfPath = getDiagramFilePath("test", "pdf");

      expect(svgPath).toContain("test");
      expect(svgPath).toContain("diagram.svg");
      expect(pngPath).toContain("diagram.png");
      expect(pdfPath).toContain("diagram.pdf");
    });

    it("should place files in preview_id subdirectory", () => {
      const filePath = getDiagramFilePath("architecture", "svg");
      expect(filePath).toContain("live/architecture/diagram.svg");
    });
  });

  describe("getDiagramSourcePath", () => {
    it("should return .mmd file in preview directory", () => {
      const sourcePath = getDiagramSourcePath("architecture");
      expect(sourcePath).toContain("architecture");
      expect(sourcePath).toContain("diagram.mmd");
    });
  });

  describe("getDiagramOptionsPath", () => {
    it("should return options.json file in preview directory", () => {
      const optionsPath = getDiagramOptionsPath("architecture");
      expect(optionsPath).toContain("architecture");
      expect(optionsPath).toContain("options.json");
    });
  });

  describe("saveDiagramSource and loadDiagramSource", () => {
    let testDir: string;
    const testPreviewId = "test-save-load";
    const testDiagram = "graph TD; A-->B";
    const testOptions = {
      theme: "dark",
      background: "transparent",
      width: 1024,
      height: 768,
      scale: 3,
    };

    beforeEach(async () => {
      testDir = getPreviewDir(testPreviewId);
      await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      await rm(testDir, { recursive: true, force: true }).catch(() => {});
    });

    it("should save and load diagram source", async () => {
      await saveDiagramSource(testPreviewId, testDiagram, testOptions);
      const loadedDiagram = await loadDiagramSource(testPreviewId);
      expect(loadedDiagram).toBe(testDiagram);
    });

    it("should save and load diagram options", async () => {
      await saveDiagramSource(testPreviewId, testDiagram, testOptions);
      const loadedOptions = await loadDiagramOptions(testPreviewId);
      expect(loadedOptions).toEqual(testOptions);
    });

    it("should create both .mmd and options.json files", async () => {
      await saveDiagramSource(testPreviewId, testDiagram, testOptions);
      const files = await readdir(testDir);
      expect(files).toContain("diagram.mmd");
      expect(files).toContain("options.json");
    });

    it("should preserve all option properties", async () => {
      await saveDiagramSource(testPreviewId, testDiagram, testOptions);
      const loadedOptions = await loadDiagramOptions(testPreviewId);
      expect(loadedOptions.theme).toBe("dark");
      expect(loadedOptions.background).toBe("transparent");
      expect(loadedOptions.width).toBe(1024);
      expect(loadedOptions.height).toBe(768);
      expect(loadedOptions.scale).toBe(3);
    });
  });

  describe("validateSavePath", () => {
    it("should allow valid relative paths", () => {
      expect(() => validateSavePath("./diagrams/test.svg")).not.toThrow();
      expect(() => validateSavePath("docs/diagram.png")).not.toThrow();
      expect(() => validateSavePath("../output/diagram.pdf")).not.toThrow();
    });

    it("should allow valid absolute paths", () => {
      expect(() => validateSavePath("/tmp/diagram.svg")).not.toThrow();
      expect(() => validateSavePath("/home/user/diagrams/test.svg")).not.toThrow();
    });

    it("should reject paths with null bytes", () => {
      expect(() => validateSavePath("diagram\0.svg")).toThrow("Path contains null bytes");
      expect(() => validateSavePath("/tmp/\0file.svg")).toThrow("Path contains null bytes");
    });

    it("should reject Unix system directories", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "linux" });

      expect(() => validateSavePath("/etc/diagram.svg")).toThrow(
        "Cannot write to system directories"
      );
      expect(() => validateSavePath("/bin/diagram.svg")).toThrow(
        "Cannot write to system directories"
      );
      expect(() => validateSavePath("/sbin/diagram.svg")).toThrow(
        "Cannot write to system directories"
      );
      expect(() => validateSavePath("/usr/bin/diagram.svg")).toThrow(
        "Cannot write to system directories"
      );
      expect(() => validateSavePath("/usr/sbin/diagram.svg")).toThrow(
        "Cannot write to system directories"
      );
      expect(() => validateSavePath("/boot/diagram.svg")).toThrow(
        "Cannot write to system directories"
      );
      expect(() => validateSavePath("/sys/diagram.svg")).toThrow(
        "Cannot write to system directories"
      );
      expect(() => validateSavePath("/proc/diagram.svg")).toThrow(
        "Cannot write to system directories"
      );

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should allow paths in user directories", () => {
      expect(() => validateSavePath("/home/user/docs/diagram.svg")).not.toThrow();
      expect(() => validateSavePath("/Users/john/projects/diagram.svg")).not.toThrow();
    });

    it("should allow paths in tmp directory", () => {
      expect(() => validateSavePath("/tmp/diagram.svg")).not.toThrow();
      expect(() => validateSavePath("/var/tmp/test.svg")).not.toThrow();
    });

    it("should handle path traversal attempts in cwd", () => {
      // These should not throw - they resolve to valid paths
      expect(() => validateSavePath("../../diagram.svg")).not.toThrow();
      expect(() => validateSavePath("./../../output/test.svg")).not.toThrow();
    });

    it("should normalize paths before validation", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "linux" });

      // Path traversal that tries to reach /etc
      expect(() => validateSavePath("/tmp/../etc/passwd")).toThrow(
        "Cannot write to system directories"
      );

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });
  });
});
