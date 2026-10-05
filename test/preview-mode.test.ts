import { describe, it, expect } from "vitest";
import { resolvePreviewMode } from "../src/preview-mode.js";

describe("resolvePreviewMode", () => {
  it("defaults to live", () => {
    expect(resolvePreviewMode([], {})).toBe("live");
    expect(resolvePreviewMode([], { CLAUDE_MERMAID_PREVIEW: "" })).toBe("live");
  });

  it("reads the environment variable", () => {
    expect(resolvePreviewMode([], { CLAUDE_MERMAID_PREVIEW: "artifact" })).toBe("artifact");
  });

  it("prefers the flag over the environment variable", () => {
    const argv = ["node", "index.js", "--preview", "artifact"];
    expect(resolvePreviewMode(argv, { CLAUDE_MERMAID_PREVIEW: "live" })).toBe("artifact");
  });

  it("rejects unknown modes", () => {
    expect(() => resolvePreviewMode(["--preview", "popup"], {})).toThrow("Invalid preview mode");
  });
});
