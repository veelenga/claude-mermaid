import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile, writeFile } from "fs/promises";
import {
  ArtifactPreviewBackend,
  buildArtifactPage,
  toPageTitle,
} from "../src/artifact-preview-backend.js";
import { getArtifactPagePath, getDiagramFilePath } from "../src/file-utils.js";
import { setupTestEnvWithPreview, restoreTestEnv } from "./helpers/env-helpers.js";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><text>hello $& world</text></svg>';

describe("toPageTitle", () => {
  it("turns a kebab or snake case preview id into a readable title", () => {
    expect(toPageTitle("auth-flow")).toBe("Auth flow");
    expect(toPageTitle("data_model_v2")).toBe("Data model v2");
    expect(toPageTitle("architecture")).toBe("Architecture");
  });
});

describe("buildArtifactPage", () => {
  it("inlines the diagram, styles and script into a document fragment", async () => {
    const page = await buildArtifactPage("auth-flow", SVG, "white");

    expect(page).toContain("<title>Auth flow</title>");
    expect(page).toContain(SVG);
    expect(page).toContain('data-diagram-id="auth-flow"');
    expect(page).toContain('data-live-enabled="false"');
    expect(page).toContain("background: white");
    expect(page).toMatch(/<style>[\s\S]*\.viewport[\s\S]*<\/style>/);
    expect(page).toMatch(/<script>[\s\S]*zoomAtPoint[\s\S]*<\/script>/);
    expect(page).not.toMatch(/WebSocket|downloadBlob/);
  });

  it("does not emit a document skeleton or external resources", async () => {
    const page = await buildArtifactPage("auth-flow", SVG, "white");

    expect(page).not.toMatch(/<!doctype/i);
    expect(page).not.toMatch(/<html|<head|<body/);
    expect(page).not.toMatch(/<link\s/);
    expect(page).not.toMatch(/<script\s+src=/);
  });

  it("escapes user controlled values", async () => {
    const page = await buildArtifactPage("auth-flow", SVG, '"><img src=x>');

    expect(page).toContain("background: &quot;&gt;&lt;img src=x&gt;");
    expect(page).not.toContain('background: "><img');
  });
});

describe("ArtifactPreviewBackend", () => {
  const previewId = "artifact-test";

  beforeEach(async () => {
    await setupTestEnvWithPreview(previewId);
  });

  afterEach(async () => {
    await restoreTestEnv();
  });

  it("writes the artifact page next to the rendered diagram and reports its path", async () => {
    const filePath = getDiagramFilePath(previewId, "svg");
    await writeFile(filePath, SVG, "utf-8");

    const text = await new ArtifactPreviewBackend().present({
      previewId,
      filePath,
      format: "svg",
      background: "transparent",
    });

    const pagePath = getArtifactPagePath(previewId);
    const page = await readFile(pagePath, "utf-8");

    expect(page).toContain(SVG);
    expect(page).toContain("background: transparent");
    expect(text).toContain(`Artifact page: ${pagePath}`);
    expect(text).toContain(`Working file: ${filePath} (SVG)`);
    expect(text).toMatch(/republish this same path/);
  });
});
