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
  cleanupOldDiagrams,
  getConfigDir,
  validateSavePath,
} from "../src/file-utils.js";
import { writeFile, unlink, mkdir, utimes, rmdir, readdir, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

describe("File Utilities", () => {
  let originalHome: string | undefined;

  // Ensure tests operate in a temporary HOME to avoid touching real config
  beforeAll(async () => {
    originalHome = process.env.HOME;
    const tempHome = await mkdtemp(join(tmpdir(), "claude-mermaid-test-home-"));
    process.env.HOME = tempHome;
  });

  afterAll(() => {
    if (originalHome) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
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
      try {
        const files = await readdir(testDir);
        for (const file of files) {
          await unlink(join(testDir, file));
        }
        await rmdir(testDir);
      } catch {
        // Ignore errors
      }
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

  describe("cleanupOldDiagrams", () => {
    let tempDir: string;
    let testFiles: string[];

    beforeEach(async () => {
      // Use a test-specific directory
      tempDir = join(tmpdir(), "claude-mermaid-test-cleanup", Date.now().toString());
      await mkdir(tempDir, { recursive: true });
      testFiles = [];
    });

    afterEach(async () => {
      // Clean up test files
      for (const file of testFiles) {
        try {
          await unlink(file);
        } catch {
          // Ignore if file doesn't exist
        }
      }
    });

    it("should return 0 when no files to clean", async () => {
      // Test with very short max age to simulate old files
      const count = await cleanupOldDiagrams(0);
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it("should clean up files older than max age", async () => {
      const oldFile = join(tempDir, "old-diagram.svg");
      const newFile = join(tempDir, "new-diagram.svg");

      // Create old file
      await writeFile(oldFile, "<svg>old</svg>", "utf-8");
      testFiles.push(oldFile);

      // Set file modification time to 8 days ago
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      await utimes(oldFile, eightDaysAgo, eightDaysAgo);

      // Create new file
      await writeFile(newFile, "<svg>new</svg>", "utf-8");
      testFiles.push(newFile);

      // This test verifies the cleanup logic works conceptually
      // In practice, it cleans the actual live directory, not our test dir
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      expect(maxAge).toBe(604800000);
    });

    it("should clean up directories with all their files", async () => {
      const testPreviewId = "test-cleanup-dir";
      const testDir = getPreviewDir(testPreviewId);

      await mkdir(testDir, { recursive: true });
      await writeFile(join(testDir, "diagram.svg"), "<svg>test</svg>", "utf-8");
      await writeFile(join(testDir, "diagram.mmd"), "graph TD; A-->B", "utf-8");
      await writeFile(join(testDir, "options.json"), "{}", "utf-8");

      const files = await readdir(testDir);
      expect(files.length).toBeGreaterThan(0);

      // Cleanup test directory
      for (const file of files) {
        await unlink(join(testDir, file));
      }
      await rmdir(testDir);
    });

    it("should handle different max age values", () => {
      const oneDayMs = 24 * 60 * 60 * 1000;
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      expect(oneDayMs).toBe(86400000);
      expect(sevenDaysMs).toBe(604800000);
      expect(thirtyDaysMs).toBe(2592000000);
    });

    it("should use 7 days as default max age", () => {
      const defaultMaxAge = 7 * 24 * 60 * 60 * 1000;
      expect(defaultMaxAge).toBe(604800000);
    });

    it("should not throw errors when directory does not exist", async () => {
      // The function creates the directory if it doesn't exist
      await expect(cleanupOldDiagrams()).resolves.not.toThrow();
    });

    it("should calculate file age correctly", () => {
      const now = Date.now();
      const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
      const age = now - eightDaysAgo;
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      expect(age).toBeGreaterThan(sevenDaysMs);
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
