import { describe, it, expect } from "vitest";
import { resolvePreviewBackendName, createPreviewBackend } from "../src/preview-backend.js";
import { PREVIEW_BACKENDS, PREVIEW_BACKEND_ENV_VAR } from "../src/constants.js";

describe("resolvePreviewBackendName", () => {
  it("defaults to the live server backend", () => {
    expect(resolvePreviewBackendName([], {})).toBe(PREVIEW_BACKENDS.LIVE);
  });

  it("reads the backend from the environment", () => {
    const env = { [PREVIEW_BACKEND_ENV_VAR]: "artifact" };
    expect(resolvePreviewBackendName([], env)).toBe(PREVIEW_BACKENDS.ARTIFACT);
  });

  it("reads the backend from a --preview flag with a separate value", () => {
    expect(resolvePreviewBackendName(["node", "cli", "--preview", "artifact"], {})).toBe(
      PREVIEW_BACKENDS.ARTIFACT
    );
  });

  it("reads the backend from an inline --preview=value flag", () => {
    expect(resolvePreviewBackendName(["node", "cli", "--preview=artifact"], {})).toBe(
      PREVIEW_BACKENDS.ARTIFACT
    );
  });

  it("prefers the flag over the environment", () => {
    const env = { [PREVIEW_BACKEND_ENV_VAR]: "artifact" };
    expect(resolvePreviewBackendName(["node", "cli", "--preview", "live"], env)).toBe(
      PREVIEW_BACKENDS.LIVE
    );
  });

  it("rejects unknown backends", () => {
    expect(() => resolvePreviewBackendName([], { [PREVIEW_BACKEND_ENV_VAR]: "cloud" })).toThrow(
      /Invalid preview backend: "cloud"/
    );
  });
});

describe("createPreviewBackend", () => {
  it("creates the backend matching the requested name", () => {
    expect(createPreviewBackend(PREVIEW_BACKENDS.LIVE).name).toBe(PREVIEW_BACKENDS.LIVE);
    expect(createPreviewBackend(PREVIEW_BACKENDS.ARTIFACT).name).toBe(PREVIEW_BACKENDS.ARTIFACT);
  });

  it("gives each backend its own tool description", () => {
    const live = createPreviewBackend(PREVIEW_BACKENDS.LIVE).toolDescription;
    const artifact = createPreviewBackend(PREVIEW_BACKENDS.ARTIFACT).toolDescription;
    expect(live).toMatch(/live reload/i);
    expect(artifact).toMatch(/Artifact tool/);
    expect(live).not.toBe(artifact);
  });
});
