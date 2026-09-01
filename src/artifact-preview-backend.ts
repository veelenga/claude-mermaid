import { readFile, writeFile } from "fs/promises";
import { getArtifactPagePath } from "./file-utils.js";
import { loadTemplate, fillTemplate, diagramPageData, escapeHtml } from "./page-renderer.js";
import { mcpLogger } from "./logger.js";
import { ASSET_FILES, TEMPLATE_FILES } from "./constants.js";
import type { PreviewBackend, PreviewRequest } from "./types.js";

export function toPageTitle(previewId: string): string {
  const words = previewId.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
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

  return fillTemplate(template, {
    PAGE_TITLE: escapeHtml(toPageTitle(previewId)),
    PAGE_STYLES: `<style>\n${styles}\n</style>`,
    PAGE_SCRIPTS: `<script>\n${script}\n</script>`,
    ...diagramPageData(previewId, svg, background),
  });
}

export class ArtifactPreviewBackend implements PreviewBackend {
  readonly toolDescription =
    "Render a Mermaid diagram into a self-contained HTML page ready to publish as a Claude artifact. " +
    "Takes Mermaid diagram code as input, validates it, and writes a page with pan and zoom controls. " +
    "Publish the returned artifact page path with the Artifact tool, and republish the same path after every update.";

  async present({ previewId, filePath, background }: PreviewRequest): Promise<string> {
    const svg = await readFile(filePath, "utf-8");
    const page = await buildArtifactPage(previewId, svg, background);
    const pagePath = getArtifactPagePath(previewId);
    await writeFile(pagePath, page, "utf-8");

    mcpLogger.info(`Artifact page written: ${previewId}`, { pagePath });

    return (
      `Mermaid diagram rendered successfully.\n` +
      `Working file: ${filePath} (SVG)\n` +
      `Artifact page: ${pagePath}\n\n` +
      `Publish the artifact page with the Artifact tool to show it to the user (suggested favicon: 📊). ` +
      `Always republish this same path after updating preview "${previewId}" so the existing artifact URL is updated in place.`
    );
  }
}
