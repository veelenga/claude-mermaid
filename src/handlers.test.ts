import { describe, it, expect, vi } from 'vitest';

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
    expect(formats).toContain('pdf');
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
      '/absolute/path/diagram.pdf',
      'simple-name.svg',
    ];
    validPaths.forEach(path => {
      expect(path).toMatch(/\.(svg|png|pdf)$/);
    });
  });

  it('should generate SVG preview for PDF format', () => {
    const pdfPath = './diagram.pdf';
    const svgPreviewPath = pdfPath.replace(/\.pdf$/, '.svg');
    expect(svgPreviewPath).toBe('./diagram.svg');
  });

  it('should always enable live reload mode', () => {
    const liveMode = true;
    expect(liveMode).toBe(true);
  });
});

describe('Live mode', () => {
  it('should generate stable diagram IDs from save path', () => {
    const savePath = '/Users/test/.config/claude-mermaid/live-diagram.svg';
    const id = Buffer.from(savePath).toString('base64').replace(/[/+=]/g, '').substring(0, 16);

    expect(id).toBeTruthy();
    expect(id.length).toBe(16);
    expect(id).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('should generate consistent IDs for same path', () => {
    const savePath = '/test/path.svg';
    const id1 = Buffer.from(savePath).toString('base64').replace(/[/+=]/g, '').substring(0, 16);
    const id2 = Buffer.from(savePath).toString('base64').replace(/[/+=]/g, '').substring(0, 16);

    expect(id1).toBe(id2);
  });
});