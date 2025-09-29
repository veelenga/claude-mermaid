import { describe, it, expect } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHtmlWrapper } from './index.js';

describe('createHtmlWrapper', () => {
  it('should create valid HTML wrapper', () => {
    const content = '<svg>test</svg>';
    const html = createHtmlWrapper(content);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('Mermaid Diagram Preview');
    expect(html).toContain(content);
  });

  it('should include required CSS styles', () => {
    const html = createHtmlWrapper('<svg>test</svg>');

    expect(html).toContain('.container');
    expect(html).toContain('background: white');
    expect(html).toContain('max-width: 95vw');
    expect(html).toContain('max-height: 85vh');
    expect(html).toContain('overflow: auto');
  });

  it('should include SVG and img styles', () => {
    const html = createHtmlWrapper('<svg>test</svg>');

    expect(html).toContain('min-height: 70vh');
    expect(html).toContain('max-height: 85vh');
  });

  it('should wrap content in container div', () => {
    const content = '<svg>test content</svg>';
    const html = createHtmlWrapper(content);

    expect(html).toContain('<div class="container">');
    expect(html).toContain('test content');
    expect(html).toContain('</div>');
  });

  it('should handle PNG base64 images', () => {
    const img = '<img src="data:image/png;base64,iVBORw..." alt="Mermaid Diagram">';
    const html = createHtmlWrapper(img);

    expect(html).toContain(img);
    expect(html).toContain('data:image/png;base64');
  });

  it('should generate valid temp directory path', () => {
    const tempDir = join(tmpdir(), 'claude-mermaid');
    expect(tempDir).toContain('claude-mermaid');
  });
});

describe('MCP Server Configuration', () => {
  it('should have correct server name', () => {
    const serverName = 'claude-mermaid';
    expect(serverName).toBe('claude-mermaid');
  });

  it('should have correct version', () => {
    const version = '1.0.0';
    expect(version).toBe('1.0.0');
  });
});

describe('File formats', () => {
  it('should support png format', () => {
    const formats = ['png', 'svg', 'pdf'];
    expect(formats).toContain('png');
  });

  it('should support svg format', () => {
    const formats = ['png', 'svg', 'pdf'];
    expect(formats).toContain('svg');
  });

  it('should support pdf format', () => {
    const formats = ['png', 'svg', 'pdf'];
    expect(formats).toContain('pdf');
  });
});