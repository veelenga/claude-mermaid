import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { ASSET_FILES, FILE_NAMES } from "./constants.js";
import { getPreviewDir } from "./file-utils.js";
import { escapeHtml, loadTemplate, replaceVariables } from "./page-renderer.js";

const TEMPLATE_FILE = "artifact-template.html";

export async function writeArtifactPage(
  previewId: string,
  svgPath: string,
  background: string
): Promise<string> {
  const [template, styles, script, svg] = await Promise.all([
    loadTemplate(TEMPLATE_FILE),
    loadTemplate(ASSET_FILES.STYLE),
    loadTemplate(ASSET_FILES.VIEWER_SCRIPT),
    readFile(svgPath, "utf-8"),
  ]);

  const page = replaceVariables(
    template,
    {
      TITLE: escapeHtml(previewId),
      STYLES: `<style>\n${styles}</style>`,
      BACKGROUND: escapeHtml(background),
      CONTENT: svg,
      SCRIPT: `<script>\n${script}</script>`,
    },
    false
  );

  const pagePath = join(getPreviewDir(previewId), FILE_NAMES.ARTIFACT_PAGE);
  await writeFile(pagePath, page, "utf-8");
  return pagePath;
}
