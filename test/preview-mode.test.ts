import { describe, it, expect } from "vitest";
import { resolvePreviewMode } from "../src/preview-mode.js";

describe("resolvePreviewMode", () => {
  it("falls back when the value is missing or empty", () => {
    expect(resolvePreviewMode(undefined, "live")).toBe("live");
    expect(resolvePreviewMode("", "artifact")).toBe("artifact");
  });

  it("prefers the given value over the fallback", () => {
    expect(resolvePreviewMode("artifact", "live")).toBe("artifact");
  });

  it("rejects unknown modes", () => {
    expect(() => resolvePreviewMode("popup", "live")).toThrow("Invalid preview mode");
  });
});
