import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { resetServerState, mockFetch } from "./server-setup.js";
import { ensureLiveServer, addLiveDiagram, closeLiveServer } from "../../src/live-server.js";
import { DEFAULT_DIAGRAM_OPTIONS } from "../../src/file-utils.js";

let configDir: string;
let tempDir: string;

describe("Live server responses", () => {
  beforeEach(async () => {
    configDir = await mkdtemp(join(tmpdir(), "claude-mermaid-config-test-"));
    process.env.XDG_CONFIG_HOME = configDir;

    tempDir = await mkdtemp(join(tmpdir(), "claude-mermaid-test-"));
    await closeLiveServer();
    resetServerState();
  });

  afterEach(async () => {
    await closeLiveServer();
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    await rm(configDir, { recursive: true, force: true }).catch(() => {});
    delete process.env.XDG_CONFIG_HOME;
    resetServerState();
  });

  it("includes CSP headers", async () => {
    const port = await ensureLiveServer();
    const diagramId = "csp-test";

    const diagramDir = join(configDir, "claude-mermaid", "live", diagramId);
    await mkdir(diagramDir, { recursive: true });
    const diagramPath = join(diagramDir, "diagram.svg");
    const optionsPath = join(diagramDir, "options.json");

    await writeFile(diagramPath, "<svg>test</svg>", "utf-8");
    await writeFile(optionsPath, JSON.stringify(DEFAULT_DIAGRAM_OPTIONS), "utf-8");

    await addLiveDiagram(diagramId, diagramPath);

    const response = await mockFetch(`http://localhost:${port}/${diagramId}`);
    const cspHeader = response.headers.get("content-security-policy");

    expect(cspHeader).toBeTruthy();
    expect(cspHeader).toContain("default-src 'none'");
    expect(cspHeader).toContain("script-src 'self'");
    expect(cspHeader).toContain("style-src 'self' 'unsafe-inline'");
    expect(cspHeader).toContain("img-src 'self' data: blob:");
    expect(cspHeader).toContain("connect-src 'self' ws://localhost:*");
  });

  it("serves Mermaid Live URL", async () => {
    const port = await ensureLiveServer();
    const diagramId = "data-test";

    const diagramDir = join(configDir, "claude-mermaid", "live", diagramId);
    await mkdir(diagramDir, { recursive: true });
    const svgPath = join(diagramDir, "diagram.svg");
    const sourcePath = join(diagramDir, "diagram.mmd");
    const optionsPath = join(diagramDir, "options.json");

    await writeFile(svgPath, "<svg>diagram</svg>", "utf-8");
    await writeFile(sourcePath, "graph TD;A-->B;", "utf-8");
    await writeFile(
      optionsPath,
      JSON.stringify({ ...DEFAULT_DIAGRAM_OPTIONS, theme: "forest" }),
      "utf-8"
    );

    await addLiveDiagram(diagramId, svgPath);

    const response = await mockFetch(`http://localhost:${port}/mermaid-live/${diagramId}`);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.url).toMatch(/^https:\/\/mermaid\.live\/edit#pako:/);
  });

  it("rejects invalid Mermaid Live IDs", async () => {
    const port = await ensureLiveServer();
    const response = await mockFetch(`http://localhost:${port}/mermaid-live/../etc/passwd`);
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toBe("Invalid diagram ID");
  });

  it("returns 404 for missing Mermaid Live diagram", async () => {
    const port = await ensureLiveServer();
    const response = await mockFetch(`http://localhost:${port}/mermaid-live/missing`);
    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.error).toBe("Diagram not found");
  });

  it("serves /view for a valid diagram ID", async () => {
    const port = await ensureLiveServer();
    const diagramId = "view-test";

    const diagramDir = join(configDir, "claude-mermaid", "live", diagramId);
    await mkdir(diagramDir, { recursive: true });
    await writeFile(join(diagramDir, "diagram.svg"), "<svg>view</svg>", "utf-8");
    await writeFile(
      join(diagramDir, "options.json"),
      JSON.stringify(DEFAULT_DIAGRAM_OPTIONS),
      "utf-8"
    );

    const response = await mockFetch(`http://localhost:${port}/view/${diagramId}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html");
  });

  it("rejects /view path traversal attempts", async () => {
    const port = await ensureLiveServer();
    const response = await mockFetch(`http://localhost:${port}/view/../../etc/passwd`);
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid diagram ID");
  });

  it("rejects /view URL-encoded path traversal", async () => {
    const port = await ensureLiveServer();
    const response = await mockFetch(
      `http://localhost:${port}/view/%2e%2e%2f%2e%2e%2fetc%2fpasswd`
    );
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid diagram ID");
  });
});
