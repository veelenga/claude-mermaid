import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ensureLiveServer, addLiveDiagram, hasActiveConnections } from "../src/live-server.js";
import { writeFile, unlink, mkdir, mkdtemp, readdir, rmdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

describe("Live Server", () => {
  let tempDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), "claude-mermaid-test", Date.now().toString());
    await mkdir(tempDir, { recursive: true });
    testFilePath = join(tempDir, "test-diagram.svg");
    await writeFile(testFilePath, "<svg>test</svg>", "utf-8");
  });

  afterEach(async () => {
    try {
      await unlink(testFilePath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  describe("ensureLiveServer", () => {
    it("should return a valid port number", async () => {
      const port = await ensureLiveServer();
      expect(port).toBeGreaterThanOrEqual(3737);
      expect(port).toBeLessThanOrEqual(3747);
    });

    it("should return the same port on subsequent calls", async () => {
      const port1 = await ensureLiveServer();
      const port2 = await ensureLiveServer();
      expect(port1).toBe(port2);
    });

    it("should start server in default port range", async () => {
      const port = await ensureLiveServer();
      expect(port).toBeGreaterThanOrEqual(3737);
      expect(port).toBeLessThanOrEqual(3747);
    });
  });

  describe("addLiveDiagram", () => {
    it("should add a diagram without throwing", async () => {
      const diagramId = "test-diagram-1";
      await expect(addLiveDiagram(diagramId, testFilePath)).resolves.not.toThrow();
    });

    it("should handle multiple diagrams with different IDs", async () => {
      const id1 = "diagram-1";
      const id2 = "diagram-2";

      await addLiveDiagram(id1, testFilePath);
      await addLiveDiagram(id2, testFilePath);

      expect(hasActiveConnections(id1)).toBe(false);
      expect(hasActiveConnections(id2)).toBe(false);
    });

    it("should replace existing diagram with same ID", async () => {
      const diagramId = "replace-test";

      await addLiveDiagram(diagramId, testFilePath);
      await addLiveDiagram(diagramId, testFilePath);

      expect(hasActiveConnections(diagramId)).toBe(false);
    });
  });

  describe("hasActiveConnections", () => {
    it("should return false for non-existent diagram", () => {
      expect(hasActiveConnections("non-existent")).toBe(false);
    });

    it("should return false for newly added diagram", async () => {
      const diagramId = "new-diagram";
      await addLiveDiagram(diagramId, testFilePath);
      expect(hasActiveConnections(diagramId)).toBe(false);
    });

    it("should return false after adding diagram without connections", async () => {
      const diagramId = "test-no-connections";
      await addLiveDiagram(diagramId, testFilePath);
      expect(hasActiveConnections(diagramId)).toBe(false);
    });
  });
});

describe("Template rendering", () => {
  let tempDir: string;
  let testFilePath: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    // Override HOME to use temp directory
    originalHome = process.env.HOME;
    const tempHome = await mkdtemp(join(tmpdir(), "claude-mermaid-render-test-"));
    process.env.HOME = tempHome;

    tempDir = join(tmpdir(), "claude-mermaid-template-test", Date.now().toString());
    await mkdir(tempDir, { recursive: true });
    testFilePath = join(tempDir, "test-diagram.svg");
    await writeFile(
      testFilePath,
      '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>',
      "utf-8"
    );
  });

  afterEach(async () => {
    try {
      await unlink(testFilePath);
    } catch {
      // Ignore if file doesn't exist
    }

    // Restore original HOME
    if (originalHome) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
  });

  it("should load template from file system", async () => {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    const { dirname } = await import("path");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const templatePath = join(__dirname, "../src/preview-template.html");

    const template = await readFile(templatePath, "utf-8");
    expect(template).toBeTruthy();
    expect(template.length).toBeGreaterThan(0);
  });

  it("should have template accessible for rendering", async () => {
    // This test verifies the template exists and can be loaded by the rendering pipeline
    // The actual rendering is tested in handlers.test.ts with mocked exec
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    const { dirname } = await import("path");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const templatePath = join(__dirname, "../src/preview-template.html");

    // Verify template can be read
    const template = await readFile(templatePath, "utf-8");
    expect(template).toBeTruthy();

    // Verify it's actual HTML content
    expect(template).toContain("<!doctype html>");
    expect(template).toContain("{{CONTENT}}");
    expect(template).toContain("{{DIAGRAM_ID}}");
  });

  it("should replace placeholders in template", async () => {
    // We can't directly test createLiveHtmlWrapper since it's not exported,
    // but we can verify the template has the right structure
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    const { dirname } = await import("path");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const templatePath = join(__dirname, "../src/preview-template.html");

    const template = await readFile(templatePath, "utf-8");

    // Verify template has placeholders that will be replaced
    expect(template).toContain("{{CONTENT}}");
    expect(template).toContain("{{DIAGRAM_ID}}");
    expect(template).toContain("{{PORT}}");
    expect(template).toContain("{{BACKGROUND}}");
    expect(template).toContain("{{TIMESTAMP}}");

    // Verify these placeholders appear in meaningful contexts
    expect(template).toContain('class="diagram-wrapper">{{CONTENT}}');
    expect(template).toContain('new WebSocket("ws://localhost:{{PORT}}/{{DIAGRAM_ID}}');
    expect(template).toContain("background: {{BACKGROUND}}");
  });

  it("should produce valid HTML structure", async () => {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    const { dirname } = await import("path");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const templatePath = join(__dirname, "../src/preview-template.html");

    const template = await readFile(templatePath, "utf-8");

    // Verify HTML5 structure
    expect(template).toMatch(/<!doctype html>/i);
    expect(template).toContain("<html");
    expect(template).toContain("<head>");
    expect(template).toContain("<body>");
    expect(template).toContain("</html>");

    // Verify has proper meta tags
    expect(template).toContain('charset="UTF-8"');
    expect(template).toContain('name="viewport"');

    // Verify has style and script tags
    expect(template).toContain("<style>");
    expect(template).toContain("</style>");
    expect(template).toContain("<script>");
    expect(template).toContain("</script>");
  });
});

describe("HTML wrapper and template", () => {
  it("should have all required placeholders in template", async () => {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    const { dirname } = await import("path");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const templatePath = join(__dirname, "../src/preview-template.html");

    const template = await readFile(templatePath, "utf-8");

    expect(template).toContain("{{CONTENT}}");
    expect(template).toContain("{{DIAGRAM_ID}}");
    expect(template).toContain("{{PORT}}");
    expect(template).toContain("{{BACKGROUND}}");
    expect(template).toContain("{{TIMESTAMP}}");
  });

  it("should have required CSS classes in template", async () => {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    const { dirname } = await import("path");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const templatePath = join(__dirname, "../src/preview-template.html");

    const template = await readFile(templatePath, "utf-8");

    expect(template).toContain('class="status-bar"');
    expect(template).toContain('class="viewport"');
    expect(template).toContain('class="diagram-wrapper"');
  });

  it("should include WebSocket reconnection logic in template", async () => {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    const { dirname } = await import("path");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const templatePath = join(__dirname, "../src/preview-template.html");

    const template = await readFile(templatePath, "utf-8");

    expect(template).toContain("new WebSocket");
    expect(template).toContain("ws.onopen");
    expect(template).toContain("ws.onclose");
    expect(template).toContain("ws.onmessage");
    expect(template).toContain('event.data === "reload"');
  });

  it("should include diagram pan and reset logic in template", async () => {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    const { dirname } = await import("path");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const templatePath = join(__dirname, "../src/preview-template.html");

    const template = await readFile(templatePath, "utf-8");

    expect(template).toContain("function resetPan");
    expect(template).toContain("isDragging");
    expect(template).toContain("reset-pan-btn");
  });

  it("should have viewport and status bar styles in template", async () => {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    const { dirname } = await import("path");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const templatePath = join(__dirname, "../src/preview-template.html");

    const template = await readFile(templatePath, "utf-8");

    expect(template).toContain(".viewport");
    expect(template).toContain(".status-bar");
    expect(template).toContain("box-sizing: border-box");
  });
});
