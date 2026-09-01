import { readFile, writeFile } from "fs/promises";
import { getArtifactPagePath } from "./file-utils.js";
import { loadTemplate, escapeHtml } from "./page-renderer.js";
import { mcpLogger } from "./logger.js";
import {
  ARTIFACT_FAVICON,
  ASSET_FILES,
  PREVIEW_BACKENDS,
  TEMPLATE_FILES,
  TEMPLATE_VARS,
} from "./constants.js";
import type { PreviewBackend, PreviewRequest } from "./types.js";

export function toPageTitle(previewId: string): string {
  const words = previewId.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function fill(template: string, placeholder: string, value: string): string {
  return template.replaceAll(placeholder, () => value);
}

function wrapInTag(tag: string, content: string): string {
  return `<${tag}>\n${content}\n</${tag}>`;
}

export async function buildArtifactPage(
  previewId: string,
  svg: string,
  background: string
): Promise<string> {
  const [template, styles, script] = await Promise.all([
    loadTemplate(TEMPLATE_FILES.ARTIFACT),
    loadTemplate(ASSET_FILES.STYLE),
    loadTemplate(ASSET_FILES.VIEWER_SCRIPT),
  ]);

  const replacements: Array<[string, string]> = [
    [TEMPLATE_VARS.TITLE, escapeHtml(toPageTitle(previewId))],
    [TEMPLATE_VARS.STYLES, wrapInTag("style", styles)],
    [TEMPLATE_VARS.SCRIPT, wrapInTag("script", script)],
    [TEMPLATE_VARS.CONTENT, svg],
    [TEMPLATE_VARS.DIAGRAM_ID, escapeHtml(previewId)],
    [TEMPLATE_VARS.BACKGROUND, escapeHtml(background)],
    [TEMPLATE_VARS.TIMESTAMP, escapeHtml(new Date().toLocaleTimeString())],
  ];

  return replacements.reduce(
    (page, [placeholder, value]) => fill(page, placeholder, value),
    template
  );
}

export class ArtifactPreviewBackend implements PreviewBackend {
  readonly name = PREVIEW_BACKENDS.ARTIFACT;

  readonly toolDescription =
    "Render a Mermaid diagram into a self-contained HTML page ready to publish as a Claude artifact. " +
    "Takes Mermaid diagram code as input, validates it, and writes a page with pan and zoom controls. " +
    "Publish the returned artifact page path with the Artifact tool, and republish the same path after every update.";

  async present({ previewId, filePath, format, background }: PreviewRequest): Promise<string> {
    const svg = await readFile(filePath, "utf-8");
    const page = await buildArtifactPage(previewId, svg, background);
    const pagePath = getArtifactPagePath(previewId);
    await writeFile(pagePath, page, "utf-8");

    mcpLogger.info(`Artifact page written: ${previewId}`, { pagePath });

    return (
      `Mermaid diagram rendered successfully.\n` +
      `Working file: ${filePath} (${format.toUpperCase()})\n` +
      `Artifact page: ${pagePath}\n\n` +
      `Publish the artifact page with the Artifact tool to show it to the user (suggested favicon: ${ARTIFACT_FAVICON}). ` +
      `Always republish this same path after updating preview "${previewId}" so the existing artifact URL is updated in place.`
    );
  }
}
