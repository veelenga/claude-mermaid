/**
 * Unit tests for diagram-service.ts
 * Tests business logic for diagram data access and management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  listDiagrams,
  getDiagramInfo,
  searchDiagrams,
  diagramExists,
  getDiagramCount,
} from "../src/diagram-service.js";
import * as fileUtils from "../src/file-utils.js";
import { readdir, stat, mkdir, writeFile, rmdir, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("Diagram Service", () => {
  let testHomeDir: string;
  let testLiveDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    // Create temporary HOME directory to isolate tests
    originalHome = process.env.HOME;
    testHomeDir = join(tmpdir(), `diagram-service-test-home-${Date.now()}`);
    process.env.HOME = testHomeDir;

    // Live dir will be: testHomeDir/.config/claude-mermaid/live
    testLiveDir = join(testHomeDir, ".config", "claude-mermaid", "live");
    await mkdir(testLiveDir, { recursive: true });
  });

  afterEach(async () => {
    // Restore original HOME
    if (originalHome) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }

    // Cleanup test directory
    try {
      const entries = await readdir(testLiveDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(testLiveDir, entry.name);
        if (entry.isDirectory()) {
          const files = await readdir(fullPath);
          for (const file of files) {
            await unlink(join(fullPath, file));
          }
          await rmdir(fullPath);
        } else {
          await unlink(fullPath);
        }
      }
      await rmdir(testLiveDir);
      await rmdir(join(testHomeDir, ".config", "claude-mermaid"));
      await rmdir(join(testHomeDir, ".config"));
      await rmdir(testHomeDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("listDiagrams", () => {
    it("should return empty array when no diagrams exist", async () => {
      const diagrams = await listDiagrams();
      expect(diagrams).toEqual([]);
    });

    it("should list all valid diagrams", async () => {
      await createTestDiagram("test-diagram-1", "svg");
      await delay(10); // Ensure different timestamps
      await createTestDiagram("test-diagram-2", "png");

      const diagrams = await listDiagrams();

      expect(diagrams).toHaveLength(2);
      // Sorted by modification time, newest first
      expect(diagrams[0].id).toBe("test-diagram-2");
      expect(diagrams[0].format).toBe("png");
      expect(diagrams[1].id).toBe("test-diagram-1");
      expect(diagrams[1].format).toBe("svg");
    });

    it("should sort diagrams by modification time (newest first)", async () => {
      await createTestDiagram("old-diagram", "svg");
      await delay(100);
      await createTestDiagram("new-diagram", "svg");

      const diagrams = await listDiagrams();

      expect(diagrams).toHaveLength(2);
      expect(diagrams[0].id).toBe("new-diagram");
      expect(diagrams[1].id).toBe("old-diagram");
    });

    it("should skip invalid directory names", async () => {
      await createTestDiagram("valid-diagram", "svg");
      await mkdir(join(testLiveDir, "invalid..diagram"), { recursive: true });

      const diagrams = await listDiagrams();

      expect(diagrams).toHaveLength(1);
      expect(diagrams[0].id).toBe("valid-diagram");
    });

    it("should skip directories without diagram files", async () => {
      const emptyDir = join(testLiveDir, "empty-diagram");
      await mkdir(emptyDir, { recursive: true });
      await createTestDiagram("valid-diagram", "svg");

      const diagrams = await listDiagrams();

      expect(diagrams).toHaveLength(1);
      expect(diagrams[0].id).toBe("valid-diagram");
    });

    it("should include file size and modification date", async () => {
      // Arrange
      await createTestDiagram("test-diagram", "svg");

      const diagrams = await listDiagrams();

      expect(diagrams).toHaveLength(1);
      expect(diagrams[0].sizeBytes).toBeGreaterThan(0);
      expect(diagrams[0].modifiedAt).toBeInstanceOf(Date);
    });
  });

  describe("getDiagramInfo", () => {
    it("should return diagram info for existing diagram", async () => {
      // Arrange
      await createTestDiagram("test-diagram", "svg");

      const info = await getDiagramInfo("test-diagram");

      expect(info).not.toBeNull();
      expect(info!.id).toBe("test-diagram");
      expect(info!.format).toBe("svg");
      expect(info!.sizeBytes).toBeGreaterThan(0);
      expect(info!.modifiedAt).toBeInstanceOf(Date);
    });

    it("should return null for non-existent diagram", async () => {
      const info = await getDiagramInfo("non-existent");

      expect(info).toBeNull();
    });

    it("should validate preview ID format", async () => {
      const info = await getDiagramInfo("invalid..id");

      expect(info).toBeNull();
    });

    it("should try all formats and return first found", async () => {
      await createTestDiagram("test-diagram", "png");

      const info = await getDiagramInfo("test-diagram");

      expect(info).not.toBeNull();
      expect(info!.format).toBe("png");
    });

    it("should prefer SVG over other formats", async () => {
      const diagramDir = join(testLiveDir, "test-diagram");
      await mkdir(diagramDir, { recursive: true });
      await writeFile(join(diagramDir, "diagram.svg"), "<svg></svg>");
      await delay(10);
      await writeFile(join(diagramDir, "diagram.png"), "png-data");

      const info = await getDiagramInfo("test-diagram");

      expect(info).not.toBeNull();
      expect(info!.format).toBe("svg");
    });
  });

  describe("searchDiagrams", () => {
    beforeEach(async () => {
      // Create test diagrams with various IDs
      await createTestDiagram("user-profile", "svg");
      await createTestDiagram("user-settings", "svg");
      await createTestDiagram("admin-dashboard", "svg");
      await createTestDiagram("product-catalog", "svg");
    });

    it("should return all diagrams for empty query", async () => {
      const results = await searchDiagrams("");

      expect(results).toHaveLength(4);
    });

    it("should return all diagrams for whitespace-only query", async () => {
      const results = await searchDiagrams("   ");

      expect(results).toHaveLength(4);
    });

    it("should filter diagrams by exact match", async () => {
      const results = await searchDiagrams("user-profile");

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("user-profile");
    });

    it("should filter diagrams by partial match", async () => {
      const results = await searchDiagrams("user");

      expect(results).toHaveLength(2);
      expect(results.map((d) => d.id).sort()).toEqual(["user-profile", "user-settings"]);
    });

    it("should be case-insensitive", async () => {
      const results = await searchDiagrams("USER");

      expect(results).toHaveLength(2);
    });

    it("should trim query whitespace", async () => {
      const results = await searchDiagrams("  admin  ");

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("admin-dashboard");
    });

    it("should return empty array for no matches", async () => {
      const results = await searchDiagrams("nonexistent");

      expect(results).toEqual([]);
    });
  });

  describe("diagramExists", () => {
    it("should return true for existing diagram", async () => {
      // Arrange
      await createTestDiagram("test-diagram", "svg");

      const exists = await diagramExists("test-diagram");

      expect(exists).toBe(true);
    });

    it("should return false for non-existent diagram", async () => {
      const exists = await diagramExists("non-existent");

      expect(exists).toBe(false);
    });

    it("should return false for invalid preview ID", async () => {
      const exists = await diagramExists("invalid..id");

      expect(exists).toBe(false);
    });
  });

  describe("getDiagramCount", () => {
    it("should return 0 when no diagrams exist", async () => {
      const count = await getDiagramCount();

      expect(count).toBe(0);
    });

    it("should return correct count of diagrams", async () => {
      // Arrange
      await createTestDiagram("diagram-1", "svg");
      await createTestDiagram("diagram-2", "svg");
      await createTestDiagram("diagram-3", "svg");

      const count = await getDiagramCount();

      expect(count).toBe(3);
    });
  });

  // Helper functions
  async function createTestDiagram(id: string, format: string): Promise<void> {
    const diagramDir = join(testLiveDir, id);
    await mkdir(diagramDir, { recursive: true });
    const content = format === "svg" ? "<svg>test</svg>" : "binary-data";
    await writeFile(join(diagramDir, `diagram.${format}`), content);
  }

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
});
