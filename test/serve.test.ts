import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  execFile: vi.fn((_cmd: string, _args: string[], cb: Function) => cb(null)),
}));

vi.mock("fs/promises", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    readdir: vi.fn(),
    access: vi.fn(),
  };
});

vi.mock("../src/live-server.js", () => ({
  ensureLiveServer: vi.fn().mockResolvedValue(3737),
  addLiveDiagram: vi.fn().mockResolvedValue(undefined),
}));

import { readdir, access } from "fs/promises";
import { ensureLiveServer, addLiveDiagram } from "../src/live-server.js";
import { startServeMode } from "../src/serve.js";

const mockReaddir = vi.mocked(readdir);
const mockAccess = vi.mocked(access);
const mockEnsureLiveServer = vi.mocked(ensureLiveServer);
const mockAddLiveDiagram = vi.mocked(addLiveDiagram);

describe("startServeMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureLiveServer.mockResolvedValue(3737);
  });

  it("starts the live server and opens the gallery", async () => {
    mockReaddir.mockResolvedValue([] as any);

    await startServeMode();

    expect(mockEnsureLiveServer).toHaveBeenCalled();
  });

  it("registers existing diagrams that have an SVG file", async () => {
    mockReaddir.mockResolvedValue([
      { name: "flow", isDirectory: () => true },
      { name: "arch", isDirectory: () => true },
    ] as any);
    mockAccess.mockResolvedValue(undefined);

    await startServeMode();

    expect(mockAddLiveDiagram).toHaveBeenCalledTimes(2);
    expect(mockAddLiveDiagram).toHaveBeenCalledWith("flow", expect.stringContaining("diagram.svg"));
    expect(mockAddLiveDiagram).toHaveBeenCalledWith("arch", expect.stringContaining("diagram.svg"));
  });

  it("skips directories without an SVG file", async () => {
    mockReaddir.mockResolvedValue([
      { name: "good", isDirectory: () => true },
      { name: "bad", isDirectory: () => true },
    ] as any);
    mockAccess.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("ENOENT"));

    await startServeMode();

    expect(mockAddLiveDiagram).toHaveBeenCalledTimes(1);
    expect(mockAddLiveDiagram).toHaveBeenCalledWith("good", expect.stringContaining("diagram.svg"));
  });

  it("skips non-directory entries", async () => {
    mockReaddir.mockResolvedValue([{ name: "file.txt", isDirectory: () => false }] as any);

    await startServeMode();

    expect(mockAddLiveDiagram).not.toHaveBeenCalled();
  });

  it("handles empty live directory gracefully", async () => {
    mockReaddir.mockRejectedValue(new Error("ENOENT"));

    await startServeMode();

    expect(mockAddLiveDiagram).not.toHaveBeenCalled();
    expect(mockEnsureLiveServer).toHaveBeenCalled();
  });
});
