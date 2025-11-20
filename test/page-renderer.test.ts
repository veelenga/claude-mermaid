/**
 * Unit tests for page-renderer.ts
 * Tests generic page rendering with template composition
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderPage, escapeHtml, clearTemplateCache } from "../src/page-renderer.js";
import { writeFile, mkdir, rmdir, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("Page Renderer", () => {
  let testPreviewDir: string;
  let originalDirname: string;

  beforeEach(async () => {
    // Create temporary preview directory
    testPreviewDir = join(tmpdir(), `page-renderer-test-${Date.now()}`);
    await mkdir(testPreviewDir, { recursive: true });

    // Clear template cache before each test
    clearTemplateCache();
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      const files = await import("fs/promises").then((fs) => fs.readdir(testPreviewDir));
      for (const file of files) {
        await unlink(join(testPreviewDir, file));
      }
      await rmdir(testPreviewDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("escapeHtml", () => {
    it("should escape ampersands", () => {
      expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
    });

    it("should escape less-than signs", () => {
      expect(escapeHtml("a < b")).toBe("a &lt; b");
    });

    it("should escape greater-than signs", () => {
      expect(escapeHtml("a > b")).toBe("a &gt; b");
    });

    it("should escape double quotes", () => {
      expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
    });

    it("should escape single quotes", () => {
      expect(escapeHtml("it's")).toBe("it&#039;s");
    });

    it("should escape all special characters", () => {
      const input = `<script>alert("XSS & 'injection'")</script>`;
      const expected = `&lt;script&gt;alert(&quot;XSS &amp; &#039;injection&#039;&quot;)&lt;/script&gt;`;
      expect(escapeHtml(input)).toBe(expected);
    });

    it("should handle empty string", () => {
      expect(escapeHtml("")).toBe("");
    });

    it("should handle string with no special characters", () => {
      expect(escapeHtml("hello world")).toBe("hello world");
    });
  });

  describe("renderPage", () => {
    it("should render page with basic template variables", async () => {
      // Arrange: Create test template
      const templateContent = `
<!DOCTYPE html>
<html>
<head><title>{{PAGE_TITLE}}</title></head>
<body>
{{CONTENT}}
</body>
</html>`;
      const templatePath = join(testPreviewDir, "test-template.html");
      await writeFile(templatePath, templateContent);

      // Mock the __dirname to point to our test directory
      // Note: In real implementation, we'd need to adjust imports or use dependency injection
      // For this test, we'll create template in the actual preview directory
      const actualPreviewDir = join(dirname(__dirname), "src", "preview");
      await writeFile(join(actualPreviewDir, "test-template.html"), templateContent);

      // Act
      const html = await renderPage(
        "test-template.html",
        { PORT: 3737, CONTENT: "<div>Hello World</div>" },
        { title: "Test Page", includeNav: false, includeFooter: false }
      );

      // Assert
      expect(html).toContain("<title>Test Page</title>");
      expect(html).toContain("<div>Hello World</div>");

      // Cleanup
      await unlink(join(actualPreviewDir, "test-template.html"));
    });

    it("should not escape content template (for SVG/HTML rendering)", async () => {
      // Arrange
      // Note: Content templates are processed with escape=false to allow HTML/SVG content
      // This is intentional for rendering diagrams and navigation
      const templateContent = "<div>{{CONTENT}}</div>";
      const actualPreviewDir = join(dirname(__dirname), "src", "preview");
      await writeFile(join(actualPreviewDir, "no-escape-test.html"), templateContent);

      // Act
      const html = await renderPage(
        "no-escape-test.html",
        { PORT: 3737, CONTENT: "<svg>test</svg>" },
        { includeNav: false, includeFooter: false }
      );

      // Assert - Content should not be escaped to allow SVG rendering
      expect(html).toContain("<svg>test</svg>");
      expect(html).not.toContain("&lt;svg&gt;");

      // Cleanup
      await unlink(join(actualPreviewDir, "no-escape-test.html"));
    });

    it("should include navigation when requested", async () => {
      // Arrange
      const templateContent = "{{NAV}}<div>Content</div>";
      const actualPreviewDir = join(dirname(__dirname), "src", "preview");
      await writeFile(join(actualPreviewDir, "nav-test.html"), templateContent);

      // Act
      const html = await renderPage(
        "nav-test.html",
        { PORT: 3737 },
        { includeNav: true, includeFooter: false }
      );

      // Assert
      expect(html).toContain('<nav class="nav">');
      expect(html).toContain('href="http://localhost:3737/"');

      // Cleanup
      await unlink(join(actualPreviewDir, "nav-test.html"));
    });

    it("should include footer when requested", async () => {
      // Arrange
      const templateContent = "<div>Content</div>{{FOOTER}}";
      const actualPreviewDir = join(dirname(__dirname), "src", "preview");
      await writeFile(join(actualPreviewDir, "footer-test.html"), templateContent);

      // Act
      const html = await renderPage(
        "footer-test.html",
        { PORT: 3737 },
        { includeNav: false, includeFooter: true }
      );

      // Assert
      expect(html).toContain('<footer class="footer">');
      expect(html).toContain("Claude Mermaid");

      // Cleanup
      await unlink(join(actualPreviewDir, "footer-test.html"));
    });

    it("should include custom styles", async () => {
      // Arrange
      const templateContent = "{{PAGE_STYLES}}<div>Content</div>";
      const actualPreviewDir = join(dirname(__dirname), "src", "preview");
      await writeFile(join(actualPreviewDir, "styles-test.html"), templateContent);

      // Act
      const html = await renderPage(
        "styles-test.html",
        { PORT: 3737 },
        { styles: ["/shared.css", "/custom.css"], includeNav: false, includeFooter: false }
      );

      // Assert
      expect(html).toContain('<link rel="stylesheet" href="/shared.css">');
      expect(html).toContain('<link rel="stylesheet" href="/custom.css">');

      // Cleanup
      await unlink(join(actualPreviewDir, "styles-test.html"));
    });

    it("should include custom scripts", async () => {
      // Arrange
      const templateContent = "<div>Content</div>{{PAGE_SCRIPTS}}";
      const actualPreviewDir = join(dirname(__dirname), "src", "preview");
      await writeFile(join(actualPreviewDir, "scripts-test.html"), templateContent);

      // Act
      const html = await renderPage(
        "scripts-test.html",
        { PORT: 3737 },
        { scripts: ["/app.js", "/utils.js"], includeNav: false, includeFooter: false }
      );

      // Assert
      expect(html).toContain('<script src="/app.js"></script>');
      expect(html).toContain('<script src="/utils.js"></script>');

      // Cleanup
      await unlink(join(actualPreviewDir, "scripts-test.html"));
    });

    it("should handle missing template gracefully", async () => {
      // Act & Assert
      await expect(
        renderPage("non-existent.html", {}, { includeNav: false, includeFooter: false })
      ).rejects.toThrow();
    });

    it("should replace all occurrences of template variables", async () => {
      // Arrange
      const templateContent = "{{VAR}} and {{VAR}} and {{VAR}}";
      const actualPreviewDir = join(dirname(__dirname), "src", "preview");
      await writeFile(join(actualPreviewDir, "multiple-vars.html"), templateContent);

      // Act
      const html = await renderPage(
        "multiple-vars.html",
        { VAR: "test" },
        { includeNav: false, includeFooter: false }
      );

      // Assert
      expect(html).toBe("test and test and test");

      // Cleanup
      await unlink(join(actualPreviewDir, "multiple-vars.html"));
    });

    it("should handle undefined values gracefully", async () => {
      // Arrange
      const templateContent = "Value: {{UNDEFINED_VAR}}";
      const actualPreviewDir = join(dirname(__dirname), "src", "preview");
      await writeFile(join(actualPreviewDir, "undefined-test.html"), templateContent);

      // Act
      const html = await renderPage(
        "undefined-test.html",
        { UNDEFINED_VAR: undefined },
        { includeNav: false, includeFooter: false }
      );

      // Assert
      expect(html).toBe("Value: ");

      // Cleanup
      await unlink(join(actualPreviewDir, "undefined-test.html"));
    });

    it("should use default options when not provided", async () => {
      // Arrange
      const templateContent = "<title>{{PAGE_TITLE}}</title>{{NAV}}{{FOOTER}}";
      const actualPreviewDir = join(dirname(__dirname), "src", "preview");
      await writeFile(join(actualPreviewDir, "defaults-test.html"), templateContent);

      // Act
      const html = await renderPage("defaults-test.html", { PORT: 3737 });

      // Assert
      expect(html).toContain("<title>Claude Mermaid</title>"); // Default title
      expect(html).toContain('<nav class="nav">'); // includeNav defaults to true
      // includeFooter defaults to false, so footer should be empty

      // Cleanup
      await unlink(join(actualPreviewDir, "defaults-test.html"));
    });
  });

  describe("clearTemplateCache", () => {
    it("should clear cached templates", async () => {
      // Arrange: Render a page to cache the template
      const templateContent = "Original: {{VALUE}}";
      const actualPreviewDir = join(dirname(__dirname), "src", "preview");
      const templatePath = join(actualPreviewDir, "cache-test.html");
      await writeFile(templatePath, templateContent);

      const html1 = await renderPage(
        "cache-test.html",
        { VALUE: "first" },
        { includeNav: false, includeFooter: false }
      );
      expect(html1).toContain("Original: first");

      // Update template
      await writeFile(templatePath, "Updated: {{VALUE}}");

      // Without clearing cache, should still use old template
      // (Note: This test might be fragile depending on caching implementation)

      // Act: Clear cache
      clearTemplateCache();

      // Render again - should use new template
      const html2 = await renderPage(
        "cache-test.html",
        { VALUE: "second" },
        { includeNav: false, includeFooter: false }
      );

      // Assert
      expect(html2).toContain("Updated: second");

      // Cleanup
      await unlink(templatePath);
    });
  });
});
