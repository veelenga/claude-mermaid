import { describe, it, expect } from "vitest";
import { resolvePreviewBackendName, createPreviewBackend } from "../src/preview-backend.js";
import { PREVIEW_BACKENDS, PREVIEW_BACKEND_ENV_VAR } from "../src/constants.js";
import { LiveServerPreviewBackend } from "../src/live-preview-backend.js";
import { ArtifactPreviewBackend } from "../src/artifact-preview-backend.js";

describe("resolvePreviewBackendName", () => {
  it("defaults to the live server backend", () => {
    expect(resolvePreviewBackendName(undefined, {})).toBe(PREVIEW_BACKENDS.LIVE);
  });

  it("reads the backend from the environment", () => {
    const env = { [PREVIEW_BACKEND_ENV_VAR]: "artifact" };
    expect(resolvePreviewBackendName(undefined, env)).toBe(PREVIEW_BACKENDS.ARTIFACT);
  });

  it("prefers an explicit request over the environment", () => {
    const env = { [PREVIEW_BACKEND_ENV_VAR]: "artifact" };
    expect(resolvePreviewBackendName("live", env)).toBe(PREVIEW_BACKENDS.LIVE);
  });

  it("rejects unknown backends", () => {
    expect(() => resolvePreviewBackendName("cloud", {})).toThrow(
      /Invalid preview backend: "cloud"/
    );
  });
});

describe("createPreviewBackend", () => {
  it("creates the backend matching the requested name", () => {
    expect(createPreviewBackend(PREVIEW_BACKENDS.LIVE)).toBeInstanceOf(LiveServerPreviewBackend);
    expect(createPreviewBackend(PREVIEW_BACKENDS.ARTIFACT)).toBeInstanceOf(ArtifactPreviewBackend);
  });

  it("gives each backend its own tool description", () => {
    const live = createPreviewBackend(PREVIEW_BACKENDS.LIVE).toolDescription;
    const artifact = createPreviewBackend(PREVIEW_BACKENDS.ARTIFACT).toolDescription;
    expect(live).toMatch(/live reload/i);
    expect(artifact).toMatch(/Artifact tool/);
    expect(live).not.toBe(artifact);
  });
});
