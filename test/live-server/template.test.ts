import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, unlink, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

let tempDir: string;
let testFilePath: string;
let originalHome: string | undefined;

beforeEach(async () => {
  originalHome = process.env.HOME;
  const tempHome = await mkdtemp(join(tmpdir(), "claude-mermaid-render-test-"));
  process.env.HOME = tempHome;

  tempDir = await mkdtemp(join(tmpdir(), "claude-mermaid-template-test-"));
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
  } catch {}

  await rm(tempDir, { recursive: true, force: true }).catch(() => {});

  if (originalHome) {
    process.env.HOME = originalHome;
  } else {
    delete process.env.HOME;
  }
});

describe("Preview template", () => {
  it("is readable from disk", async () => {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    const { dirname } = await import("path");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const templatePath = join(__dirname, "../../src/preview/template.html");

    const template = await readFile(templatePath, "utf-8");
    expect(template).toBeTruthy();
    expect(template).toContain("<!doctype html>");
  });

  it("contains required placeholders", async () => {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    const { dirname } = await import("path");

    const template = await readFile(
      join(dirname(fileURLToPath(import.meta.url)), "../../src/preview/template.html"),
      "utf-8"
    );

    expect(template).toContain("{{CONTENT}}");
    expect(template).toContain("{{DIAGRAM_ID}}");
    expect(template).toContain("{{PORT}}");
    expect(template).toContain("{{BACKGROUND}}");
    expect(template).toContain("{{TIMESTAMP}}");
    expect(template).toContain("{{LIVE_ENABLED}}");

    expect(template).toContain('data-diagram-id="{{DIAGRAM_ID}}"');
    expect(template).toContain('data-port="{{PORT}}"');
    expect(template).toContain('data-live-enabled="{{LIVE_ENABLED}}"');
    expect(template).toContain("background: {{BACKGROUND}}");
  });

  it("references CSS and script assets", async () => {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    const { dirname } = await import("path");

    const template = await readFile(
      join(dirname(fileURLToPath(import.meta.url)), "../../src/preview/template.html"),
      "utf-8"
    );

    expect(template).toContain('<link rel="stylesheet" href="/style.css"');
    expect(template).toContain('<script src="/script.js"></script>');
  });
});

// Additional tests for CSS/JS assets could be added similarly if desired
