import { describe, it, expect } from "vitest";
import { parseCliOptions } from "../src/cli.js";

describe("parseCliOptions", () => {
  it("defaults to running the MCP server", () => {
    expect(parseCliOptions([])).toEqual({ version: false, serve: false, preview: undefined });
  });

  it("recognizes the version flag in long and short form", () => {
    expect(parseCliOptions(["--version"]).version).toBe(true);
    expect(parseCliOptions(["-v"]).version).toBe(true);
  });

  it("recognizes serve mode", () => {
    expect(parseCliOptions(["--serve"]).serve).toBe(true);
  });

  it("reads the preview backend value", () => {
    expect(parseCliOptions(["--preview", "artifact"]).preview).toBe("artifact");
    expect(parseCliOptions(["--preview=artifact"]).preview).toBe("artifact");
  });

  it("rejects a preview flag without a value", () => {
    expect(() => parseCliOptions(["--preview"])).toThrow(/argument missing/);
    expect(() => parseCliOptions(["--preview", "--serve"])).toThrow(/ambiguous/);
  });

  it("rejects unknown flags", () => {
    expect(() => parseCliOptions(["--bogus"])).toThrow(/Unknown option/);
  });
});
