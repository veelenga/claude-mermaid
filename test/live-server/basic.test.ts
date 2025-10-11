import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, unlink, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { resetServerState } from "./server-setup.js";
import {
  ensureLiveServer,
  addLiveDiagram,
  hasActiveConnections,
  escapeHtml,
  __resetLiveServerForTests,
} from "../../src/live-server.js";

let configDir: string;
let tempDir: string;
let testFilePath: string;

describe("Live server basics", () => {
  beforeEach(async () => {
    configDir = await mkdtemp(join(tmpdir(), "claude-mermaid-config-test-"));
    process.env.XDG_CONFIG_HOME = configDir;

    tempDir = await mkdtemp(join(tmpdir(), "claude-mermaid-test-"));
    testFilePath = join(tempDir, "test-diagram.svg");
    await writeFile(testFilePath, "<svg>test</svg>", "utf-8");

    __resetLiveServerForTests();
    resetServerState();
  });

  afterEach(async () => {
    try {
      await unlink(testFilePath);
    } catch {}

    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    await rm(configDir, { recursive: true, force: true }).catch(() => {});

    delete process.env.XDG_CONFIG_HOME;
    __resetLiveServerForTests();
    resetServerState();
  });

  it("returns a valid port", async () => {
    const port = await ensureLiveServer();
    expect(port).toBeGreaterThanOrEqual(3737);
    expect(port).toBeLessThanOrEqual(3747);
  });

  it("returns the same port on subsequent calls", async () => {
    const port1 = await ensureLiveServer();
    const port2 = await ensureLiveServer();
    expect(port1).toBe(port2);
  });

  it("adds diagrams without throwing", async () => {
    await expect(addLiveDiagram("diagram-1", testFilePath)).resolves.not.toThrow();
  });

  it("handles multiple diagrams", async () => {
    await addLiveDiagram("diagram-1", testFilePath);
    await addLiveDiagram("diagram-2", testFilePath);

    expect(hasActiveConnections("diagram-1")).toBe(false);
    expect(hasActiveConnections("diagram-2")).toBe(false);
  });

  it("replaces existing diagram", async () => {
    const id = "replace-test";
    await addLiveDiagram(id, testFilePath);
    await addLiveDiagram(id, testFilePath);
    expect(hasActiveConnections(id)).toBe(false);
  });

  it("reports no connections for unknown diagram", () => {
    expect(hasActiveConnections("non-existent")).toBe(false);
  });

  it("reports no connections for newly added diagram", async () => {
    const id = "new-diagram";
    await addLiveDiagram(id, testFilePath);
    expect(hasActiveConnections(id)).toBe(false);
  });

  it("escapes HTML entities", () => {
    expect(escapeHtml("<script>"))
      .toBe("&lt;script&gt;");
  });
});
