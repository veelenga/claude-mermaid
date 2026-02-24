import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { resetServerState, mockFetch } from "./server-setup.js";
import { ensureLiveServer, closeLiveServer } from "../../src/live-server.js";
import { DEFAULT_DIAGRAM_OPTIONS } from "../../src/file-utils.js";
import { renderDiagram } from "../../src/handlers.js";

vi.mock("../../src/handlers.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/handlers.js")>();
  return {
    ...original,
    renderDiagram: vi.fn(),
  };
});

const mockedRenderDiagram = vi.mocked(renderDiagram);

// Minimal valid PNG (1x1 transparent pixel)
const FAKE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB" +
    "Nl7BcQAAAABJRU5ErkJggg==",
  "base64"
);

let configDir: string;

async function createDiagramFiles(
  diagramId: string,
  options: { source?: string; options?: object } = {}
): Promise<string> {
  const diagramDir = join(configDir, "claude-mermaid", "live", diagramId);
  await mkdir(diagramDir, { recursive: true });

  await writeFile(join(diagramDir, "diagram.mmd"), options.source ?? "graph TD;A-->B;", "utf-8");
  await writeFile(
    join(diagramDir, "options.json"),
    JSON.stringify(options.options ?? DEFAULT_DIAGRAM_OPTIONS),
    "utf-8"
  );

  return diagramDir;
}

describe("PNG export endpoint", () => {
  beforeEach(async () => {
    configDir = await mkdtemp(join(tmpdir(), "claude-mermaid-export-test-"));
    process.env.XDG_CONFIG_HOME = configDir;
    await closeLiveServer();
    resetServerState();
    mockedRenderDiagram.mockReset();
  });

  afterEach(async () => {
    await closeLiveServer();
    await rm(configDir, { recursive: true, force: true }).catch(() => {});
    delete process.env.XDG_CONFIG_HOME;
    resetServerState();
  });

  it("returns PNG with correct headers", async () => {
    const port = await ensureLiveServer();
    const diagramId = "export-test";
    await createDiagramFiles(diagramId);

    mockedRenderDiagram.mockImplementation(async (_options, outputPath) => {
      await writeFile(outputPath, FAKE_PNG);
    });

    const response = await mockFetch(`http://localhost:${port}/export/${diagramId}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="${diagramId}.png"`
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("passes diagram source and options to renderer", async () => {
    const port = await ensureLiveServer();
    const diagramId = "options-test";
    const diagramSource = "sequenceDiagram\nA->>B: Hello";
    const diagramOptions = { ...DEFAULT_DIAGRAM_OPTIONS, theme: "dark" };

    await createDiagramFiles(diagramId, {
      source: diagramSource,
      options: diagramOptions,
    });

    mockedRenderDiagram.mockImplementation(async (_options, outputPath) => {
      await writeFile(outputPath, FAKE_PNG);
    });

    await mockFetch(`http://localhost:${port}/export/${diagramId}`);

    expect(mockedRenderDiagram).toHaveBeenCalledOnce();
    const renderOptions = mockedRenderDiagram.mock.calls[0][0];
    expect(renderOptions.diagram).toBe(diagramSource);
    expect(renderOptions.format).toBe("png");
    expect(renderOptions.theme).toBe("dark");
    expect(renderOptions.previewId).toBe(diagramId);
  });

  it("returns 400 for invalid diagram ID", async () => {
    const port = await ensureLiveServer();
    const response = await mockFetch(`http://localhost:${port}/export/../etc/passwd`);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid diagram ID");
  });

  it("returns 400 for empty diagram ID", async () => {
    const port = await ensureLiveServer();
    const response = await mockFetch(`http://localhost:${port}/export/`);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Diagram ID is required");
  });

  it("returns 500 when diagram source is missing", async () => {
    const port = await ensureLiveServer();
    const response = await mockFetch(`http://localhost:${port}/export/nonexistent`);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Failed to export PNG");
  });

  it("returns 500 when rendering fails", async () => {
    const port = await ensureLiveServer();
    const diagramId = "render-fail";
    await createDiagramFiles(diagramId);

    mockedRenderDiagram.mockRejectedValue(new Error("mermaid-cli crashed"));

    const response = await mockFetch(`http://localhost:${port}/export/${diagramId}`);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Failed to export PNG");
  });
});
