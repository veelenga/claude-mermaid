import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { FILE_NAMES } from "./constants.js";
import { getPreviewDir } from "./file-utils.js";
import { escapeHtml, loadTemplate } from "./page-renderer.js";

const TEMPLATE_FILE = "artifact-template.html";
const STYLE_FILE = "style.css";
const SCRIPT_FILE = "script.js";
const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;

export async function writeArtifactPage(
  previewId: string,
  svgPath: string,
  background: string
): Promise<string> {
  const [template, styles, script, svg] = await Promise.all([
    loadTemplate(TEMPLATE_FILE),
    loadTemplate(STYLE_FILE),
    loadTemplate(SCRIPT_FILE),
    readFile(svgPath, "utf-8"),
  ]);

  const values: Record<string, string> = {
    TITLE: escapeHtml(previewId),
    STYLES: `<style>\n${styles}</style>`,
    BACKGROUND: escapeHtml(background),
    CONTENT: svg,
    SCRIPT: `<script>\n${script}</script>`,
  };
  const page = template.replace(
    PLACEHOLDER_PATTERN,
    (placeholder, key) => values[key] ?? placeholder
  );

  const pagePath = join(getPreviewDir(previewId), FILE_NAMES.ARTIFACT_PAGE);
  await writeFile(pagePath, page, "utf-8");
  return pagePath;
}
