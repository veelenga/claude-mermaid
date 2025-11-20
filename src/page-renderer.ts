/**
 * Page Renderer
 * Single Responsibility: Generic page rendering with template composition
 * Open/Closed Principle: Easy to add new pages without modifying this code
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { TEMPLATE_VARS, ROUTES } from "./constants.js";
import { PageData, PageRenderOptions } from "./types.js";
import { webLogger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PREVIEW_DIR = join(__dirname, "preview");

// Template cache for performance
const templateCache = new Map<string, string>();

/**
 * Loads a template file with caching
 * @param filename Template filename
 * @returns Template content
 */
async function loadTemplate(filename: string): Promise<string> {
  if (templateCache.has(filename)) {
    return templateCache.get(filename)!;
  }

  const filePath = join(PREVIEW_DIR, filename);
  const content = await readFile(filePath, "utf-8");
  templateCache.set(filename, content);

  webLogger.debug(`Loaded template: ${filename}`);
  return content;
}

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param unsafe Raw string
 * @returns Escaped string
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Replaces template variables with actual values
 * @param template Template string
 * @param data Data object with variable values
 * @param escape Whether to HTML-escape values (default: true)
 * @returns Processed template
 */
function replaceVariables(template: string, data: PageData, escape: boolean = true): string {
  let result = template;

  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    const stringValue = String(value ?? "");
    const processedValue = escape ? escapeHtml(stringValue) : stringValue;
    result = result.replaceAll(placeholder, processedValue);
  }

  return result;
}

/**
 * Generates navigation HTML
 * @param port Server port for links
 * @returns Navigation HTML
 */
function generateNav(port: number): string {
  const baseUrl = `http://localhost:${port}`;

  return `
    <nav class="nav">
      <a href="${baseUrl}${ROUTES.GALLERY}" class="nav-link">Gallery</a>
    </nav>
  `;
}

/**
 * Generates footer HTML
 * @returns Footer HTML
 */
function generateFooter(): string {
  return `
    <footer class="footer">
      <p>Claude Mermaid Preview</p>
    </footer>
  `;
}

/**
 * Renders a complete page with layout
 * @param contentTemplate Name of the content template file
 * @param data Data for template variables
 * @param options Rendering options
 * @returns Complete HTML page
 */
export async function renderPage(
  contentTemplate: string,
  data: PageData,
  options: PageRenderOptions = {}
): Promise<string> {
  const {
    title = "Claude Mermaid",
    styles = [],
    scripts = [],
    includeNav = true,
    includeFooter = false,
  } = options;

  try {
    // Load content template
    const contentHtml = await loadTemplate(contentTemplate);

    // Generate style links
    const styleLinks = styles.map((style) => `<link rel="stylesheet" href="${style}">`).join("\n");

    // Generate script tags
    const scriptTags = scripts.map((script) => `<script src="${script}"></script>`).join("\n");

    // Generate navigation if requested
    const nav = includeNav && data.PORT ? generateNav(Number(data.PORT)) : "";

    // Generate footer if requested
    const footer = includeFooter ? generateFooter() : "";

    // Combine data with layout components
    const pageData: PageData = {
      ...data,
      PAGE_TITLE: title,
      PAGE_STYLES: styleLinks,
      PAGE_SCRIPTS: scriptTags,
      NAV: nav,
      FOOTER: footer,
    };

    // Replace variables in content template (content may include HTML, don't escape)
    const processedContent = replaceVariables(contentHtml, pageData, false);

    webLogger.debug(`Rendered page: ${contentTemplate}`, {
      hasNav: includeNav,
      hasFooter: includeFooter,
      stylesCount: styles.length,
      scriptsCount: scripts.length,
    });

    return processedContent;
  } catch (error) {
    webLogger.error(`Failed to render page: ${contentTemplate}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(
      `Page rendering failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Clears the template cache
 * Useful for development when templates are modified
 */
export function clearTemplateCache(): void {
  templateCache.clear();
  webLogger.debug("Template cache cleared");
}
