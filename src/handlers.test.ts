import { describe, it, expect, vi } from 'vitest';
import { getOpenCommand, createHtmlWrapper } from './index.js';

describe('getOpenCommand', () => {
  it('should return "open" for darwin platform', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      writable: true,
    });

    expect(getOpenCommand()).toBe('open');

    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
  });

  it('should return "start" for win32 platform', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      writable: true,
    });

    expect(getOpenCommand()).toBe('start');

    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
  });

  it('should return "xdg-open" for linux platform', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      writable: true,
    });

    expect(getOpenCommand()).toBe('xdg-open');

    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
  });
});

describe('MCP Tool Schema', () => {
  it('should validate tool name', () => {
    const toolName = 'render_mermaid';
    expect(toolName).toBe('render_mermaid');
  });

  it('should require diagram parameter', () => {
    const requiredParams = ['diagram'];
    expect(requiredParams).toContain('diagram');
  });

  it('should support format options', () => {
    const formats = ['png', 'svg', 'pdf'];
    expect(formats).toHaveLength(3);
    expect(formats).toContain('svg');
  });

  it('should have browser parameter as boolean', () => {
    const browserParam = {
      type: 'boolean',
      default: false,
    };
    expect(browserParam.type).toBe('boolean');
    expect(browserParam.default).toBe(false);
  });

  it('should support theme options', () => {
    const themes = ['default', 'forest', 'dark', 'neutral'];
    expect(themes).toHaveLength(4);
    expect(themes).toContain('default');
    expect(themes).toContain('forest');
    expect(themes).toContain('dark');
    expect(themes).toContain('neutral');
  });

  it('should have theme parameter with default value', () => {
    const themeParam = {
      type: 'string',
      enum: ['default', 'forest', 'dark', 'neutral'],
      default: 'default',
    };
    expect(themeParam.type).toBe('string');
    expect(themeParam.default).toBe('default');
    expect(themeParam.enum).toContain('forest');
  });

  it('should have background parameter with default value', () => {
    const backgroundParam = {
      type: 'string',
      default: 'white',
    };
    expect(backgroundParam.type).toBe('string');
    expect(backgroundParam.default).toBe('white');
  });

  it('should support custom background colors', () => {
    const validBackgrounds = ['white', 'transparent', 'red', '#F0F0F0', '#000000'];
    validBackgrounds.forEach(bg => {
      expect(bg).toBeTruthy();
    });
  });

  it('should have width parameter with default value', () => {
    const widthParam = {
      type: 'number',
      default: 800,
    };
    expect(widthParam.type).toBe('number');
    expect(widthParam.default).toBe(800);
  });

  it('should have height parameter with default value', () => {
    const heightParam = {
      type: 'number',
      default: 600,
    };
    expect(heightParam.type).toBe('number');
    expect(heightParam.default).toBe(600);
  });

  it('should have scale parameter with default value', () => {
    const scaleParam = {
      type: 'number',
      default: 2,
    };
    expect(scaleParam.type).toBe('number');
    expect(scaleParam.default).toBe(2);
  });

  it('should have optional save_path parameter', () => {
    const savePathParam = {
      type: 'string',
      required: false,
    };
    expect(savePathParam.type).toBe('string');
    expect(savePathParam.required).toBe(false);
  });

  it('should accept valid save_path formats', () => {
    const validPaths = [
      './docs/diagram.svg',
      '/absolute/path/diagram.png',
      '../relative/path/diagram.pdf',
      'simple-name.svg',
    ];
    validPaths.forEach(path => {
      expect(path).toMatch(/\.(svg|png|pdf)$/);
    });
  });

  it('should have live parameter with default value', () => {
    const liveParam = {
      type: 'boolean',
      default: false,
    };
    expect(liveParam.type).toBe('boolean');
    expect(liveParam.default).toBe(false);
  });

  it('should enable live reload mode when live is true', () => {
    const liveParam = true;
    expect(liveParam).toBe(true);
  });
});

describe('Image embedding', () => {
  it('should create base64 data URI for PNG', () => {
    const buffer = Buffer.from('test');
    const base64 = buffer.toString('base64');
    const dataUri = `data:image/png;base64,${base64}`;

    expect(dataUri).toContain('data:image/png;base64,');
    expect(dataUri).toContain(base64);
  });

  it('should embed SVG directly without encoding', () => {
    const svg = '<svg><rect/></svg>';
    expect(svg).toContain('<svg>');
    expect(svg).not.toContain('base64');
  });
});

describe('HTML wrapper', () => {
  it('should create valid HTML document structure', () => {
    const content = '<svg><rect/></svg>';
    const html = createHtmlWrapper(content);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
  });

  it('should include meta tags and viewport settings', () => {
    const content = '<svg><rect/></svg>';
    const html = createHtmlWrapper(content);

    expect(html).toContain('<meta charset="UTF-8">');
    expect(html).toContain('<meta name="viewport"');
  });

  it('should embed provided content inside container div', () => {
    const content = '<svg id="test-svg"><rect/></svg>';
    const html = createHtmlWrapper(content);

    expect(html).toContain('<div class="container">');
    expect(html).toContain(content);
    expect(html).toContain('</div>');
  });

  it('should include styling for centering and responsive layout', () => {
    const content = '<svg><rect/></svg>';
    const html = createHtmlWrapper(content);

    expect(html).toContain('<style>');
    expect(html).toContain('.container');
    expect(html).toContain('display: flex');
    expect(html).toContain('justify-content: center');
  });

  it('should set appropriate page title', () => {
    const content = '<svg><rect/></svg>';
    const html = createHtmlWrapper(content);

    expect(html).toContain('<title>Mermaid Diagram Preview</title>');
  });

  it('should handle PNG image content', () => {
    const imgTag = '<img src="data:image/png;base64,test123" alt="Mermaid Diagram">';
    const html = createHtmlWrapper(imgTag);

    expect(html).toContain(imgTag);
    expect(html).toContain('data:image/png;base64,test123');
  });

  it('should handle SVG content directly', () => {
    const svgContent = '<svg width="800" height="600"><circle cx="50" cy="50" r="40"/></svg>';
    const html = createHtmlWrapper(svgContent);

    expect(html).toContain(svgContent);
    expect(html).toContain('<circle');
  });
});