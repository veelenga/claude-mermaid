import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ensureLiveServer,
  addLiveDiagram,
  hasActiveConnections,
  escapeHtml,
} from "../src/live-server.js";
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

    it("should include CSP headers in HTML responses", async () => {
      const { getLiveDir } = await import("../src/file-utils.js");
      const port = await ensureLiveServer();
      const diagramId = "csp-test";

      // Setup diagram directory with options file
      const diagramDir = join(getLiveDir(), diagramId);
      await mkdir(diagramDir, { recursive: true });
      const diagramPath = join(diagramDir, "diagram.svg");
      const optionsPath = join(diagramDir, "options.json");

      await writeFile(diagramPath, "<svg>test</svg>", "utf-8");
      await writeFile(
        optionsPath,
        JSON.stringify({
          theme: "default",
          background: "white",
          width: 800,
          height: 600,
          scale: 2,
        }),
        "utf-8"
      );

      await addLiveDiagram(diagramId, diagramPath);

      const response = await fetch(`http://localhost:${port}/${diagramId}`);
      const cspHeader = response.headers.get("content-security-policy");

      expect(cspHeader).toBeTruthy();
      expect(cspHeader).toContain("default-src 'none'");
      expect(cspHeader).toContain("script-src 'self'");
      expect(cspHeader).toContain("style-src 'self' 'unsafe-inline'");
      expect(cspHeader).toContain("connect-src 'self' ws://localhost:*");
    });

    it("should provide Mermaid Live URL via API", async () => {
      const { getLiveDir } = await import("../src/file-utils.js");
      const port = await ensureLiveServer();
      const diagramId = "data-test";

      const diagramDir = join(getLiveDir(), diagramId);
      await mkdir(diagramDir, { recursive: true });
      const svgPath = join(diagramDir, "diagram.svg");
      const sourcePath = join(diagramDir, "diagram.mmd");
      const optionsPath = join(diagramDir, "options.json");

      await writeFile(svgPath, "<svg>diagram</svg>", "utf-8");
      await writeFile(sourcePath, "graph TD;A-->B;", "utf-8");
      await writeFile(
        optionsPath,
        JSON.stringify({
          theme: "forest",
          background: "white",
          width: 800,
          height: 600,
          scale: 2,
        }),
        "utf-8"
      );

      await addLiveDiagram(diagramId, svgPath);

      const response = await fetch(`http://localhost:${port}/mermaid-live/${diagramId}`);
      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.url).toMatch(/^https:\/\/mermaid\.live\/edit#pako:/);
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
    const templatePath = join(__dirname, "../src/preview/template.html");

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
    const templatePath = join(__dirname, "../src/preview/template.html");

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
    const templatePath = join(__dirname, "../src/preview/template.html");

    const template = await readFile(templatePath, "utf-8");

    // Verify template has placeholders that will be replaced
    expect(template).toContain("{{CONTENT}}");
    expect(template).toContain("{{DIAGRAM_ID}}");
    expect(template).toContain("{{PORT}}");
    expect(template).toContain("{{BACKGROUND}}");
    expect(template).toContain("{{TIMESTAMP}}");
    expect(template).toContain("{{LIVE_ENABLED}}");

    // Verify data attributes for passing config to JS
    expect(template).toContain('data-diagram-id="{{DIAGRAM_ID}}"');
    expect(template).toContain('data-port="{{PORT}}"');
    expect(template).toContain('data-live-enabled="{{LIVE_ENABLED}}"');

    // Verify background in inline style
    expect(template).toContain("background: {{BACKGROUND}}");
  });

  it("should produce valid HTML structure", async () => {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    const { dirname } = await import("path");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const templatePath = join(__dirname, "../src/preview/template.html");

    const template = await readFile(templatePath, "utf-8");

    // Verify HTML5 structure
    expect(template).toMatch(/<!doctype html>/i);
    expect(template).toContain("<html");
    expect(template).toContain("<head>");
    expect(template).toContain("<body");
    expect(template).toContain("</html>");

    // Verify has proper meta tags
    expect(template).toContain('charset="UTF-8"');
    expect(template).toContain('name="viewport"');

    // Verify links to external CSS and script with absolute paths
    expect(template).toContain('<link rel="stylesheet" href="/style.css"');
    expect(template).toContain('<script src="/script.js"></script>');
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
    const templatePath = join(__dirname, "../src/preview/template.html");

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
    const templatePath = join(__dirname, "../src/preview/template.html");

    const template = await readFile(templatePath, "utf-8");

    expect(template).toContain('class="status-bar"');
    expect(template).toContain('class="viewport"');
    expect(template).toContain('class="diagram-wrapper"');
  });

  it("should include WebSocket reconnection logic in script", async () => {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    const { dirname } = await import("path");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const scriptPath = join(__dirname, "../src/preview/script.js");

    const script = await readFile(scriptPath, "utf-8");

    expect(script).toContain("new WebSocket");
    expect(script).toContain("handleWebSocketOpen");
    expect(script).toContain("handleWebSocketClose");
    expect(script).toContain("handleWebSocketMessage");
    expect(script).toContain('event.data === "reload"');
  });

  it("should include diagram pan and reset logic in script", async () => {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    const { dirname } = await import("path");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const scriptPath = join(__dirname, "../src/preview/script.js");

    const script = await readFile(scriptPath, "utf-8");

    expect(script).toContain("function resetPan");
    expect(script).toContain("isDragging");
    expect(script).toContain("reset-pan");
  });

  it("should have viewport and status bar styles in CSS", async () => {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    const { dirname } = await import("path");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const stylePath = join(__dirname, "../src/preview/style.css");

    const style = await readFile(stylePath, "utf-8");

    expect(style).toContain(".viewport");
    expect(style).toContain(".status-bar");
    expect(style).toContain("box-sizing: border-box");
  });

  it("should read config from data attributes in script", async () => {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    const { dirname } = await import("path");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const scriptPath = join(__dirname, "../src/preview/script.js");

    const script = await readFile(scriptPath, "utf-8");

    // Verify script reads from data attributes
    expect(script).toContain("body.dataset.diagramId");
    expect(script).toContain("body.dataset.port");
    expect(script).toContain("body.dataset.liveEnabled");
  });
});

describe("HTML Escaping", () => {
  describe("escapeHtml", () => {
    it("should escape ampersands", () => {
      expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
      expect(escapeHtml("&&&")).toBe("&amp;&amp;&amp;");
    });

    it("should escape less-than signs", () => {
      expect(escapeHtml("a < b")).toBe("a &lt; b");
      expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    });

    it("should escape greater-than signs", () => {
      expect(escapeHtml("a > b")).toBe("a &gt; b");
      expect(escapeHtml("</script>")).toBe("&lt;/script&gt;");
    });

    it("should escape double quotes", () => {
      expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
      expect(escapeHtml('"')).toBe("&quot;");
    });

    it("should escape single quotes", () => {
      expect(escapeHtml("it's")).toBe("it&#039;s");
      expect(escapeHtml("'")).toBe("&#039;");
    });

    it("should escape multiple special characters", () => {
      expect(escapeHtml('<div class="test">A & B</div>')).toBe(
        "&lt;div class=&quot;test&quot;&gt;A &amp; B&lt;/div&gt;"
      );
    });

    it("should handle empty strings", () => {
      expect(escapeHtml("")).toBe("");
    });

    it("should handle strings without special characters", () => {
      expect(escapeHtml("hello world")).toBe("hello world");
      expect(escapeHtml("123")).toBe("123");
    });

    it("should prevent XSS via script tags", () => {
      const xss = '<script>alert("XSS")</script>';
      const escaped = escapeHtml(xss);
      expect(escaped).toBe("&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;");
      expect(escaped).not.toContain("<script>");
      expect(escaped).not.toContain("</script>");
    });

    it("should prevent XSS via img onerror", () => {
      const xss = '<img src=x onerror="alert(1)">';
      const escaped = escapeHtml(xss);
      expect(escaped).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
      expect(escaped).not.toContain("<img");
      expect(escaped).not.toContain('onerror="alert');
    });

    it("should prevent XSS via event handlers", () => {
      const xss = 'x" onclick="alert(1)"';
      const escaped = escapeHtml(xss);
      expect(escaped).toBe("x&quot; onclick=&quot;alert(1)&quot;");
      expect(escaped).not.toContain('onclick="');
    });

    it("should prevent XSS via style injection", () => {
      const xss = "red</style><script>alert(1)</script>";
      const escaped = escapeHtml(xss);
      expect(escaped).toBe("red&lt;/style&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
      expect(escaped).not.toContain("</style>");
      expect(escaped).not.toContain("<script>");
    });

    it("should escape in correct order (ampersand first)", () => {
      // If we don't escape & first, we could double-escape
      expect(escapeHtml("&lt;")).toBe("&amp;lt;");
    });
  });
});
