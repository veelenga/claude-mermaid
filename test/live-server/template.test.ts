import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const templatePath = join(__dirname, "../../src/preview/template.html");

let template: string;

beforeAll(async () => {
  template = await readFile(templatePath, "utf-8");
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
