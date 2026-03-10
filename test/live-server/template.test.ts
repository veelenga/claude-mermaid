import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, unlink, rm, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const templatePath = join(__dirname, "../../src/preview/template.html");

let template: string;
let tempDir: string;
let testFilePath: string;
let originalHome: string | undefined;

beforeAll(async () => {
  template = await readFile(templatePath, "utf-8");
});

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
  it("is readable from disk", () => {
    expect(template).toBeTruthy();
    expect(template).toContain("<!doctype html>");
  });

  it("contains required placeholders", () => {
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

  it("references CSS and script assets", () => {
    expect(template).toContain('<link rel="stylesheet" href="/style.css"');
    expect(template).toContain('<script src="/script.js"></script>');
  });

  it("contains zoom controls", () => {
    expect(template).toContain('id="zoom-in"');
    expect(template).toContain('id="zoom-out"');
    expect(template).toContain('id="zoom-level"');
    expect(template).toContain('id="reset-pan"');
  });
});
