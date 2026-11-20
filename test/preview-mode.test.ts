import { describe, it, expect } from "vitest";
import { resolveDefaultPreviewMode } from "../src/preview-mode.js";

describe("resolveDefaultPreviewMode", () => {
  it("defaults to live", () => {
    expect(resolveDefaultPreviewMode({})).toBe("live");
    expect(resolveDefaultPreviewMode({ CLAUDE_MERMAID_PREVIEW: "" })).toBe("live");
  });

  it("reads the environment variable", () => {
    expect(resolveDefaultPreviewMode({ CLAUDE_MERMAID_PREVIEW: "artifact" })).toBe("artifact");
  });

  it("rejects unknown modes", () => {
    expect(() => resolveDefaultPreviewMode({ CLAUDE_MERMAID_PREVIEW: "popup" })).toThrow(
      "Invalid preview mode"
    );
  });
});
