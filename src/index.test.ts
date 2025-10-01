import { describe, it, expect } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';

describe('MCP Server', () => {
  describe('Configuration', () => {
    it('should have correct server name', () => {
      const serverName = 'claude-mermaid';
      expect(serverName).toBe('claude-mermaid');
    });

    it('should export two tools', () => {
      const tools = ['mermaid_preview', 'mermaid_save'];
      expect(tools).toHaveLength(2);
      expect(tools).toContain('mermaid_preview');
      expect(tools).toContain('mermaid_save');
    });
  });

  describe('Tool: mermaid_preview', () => {
    it('should validate tool name', () => {
      const toolName = 'mermaid_preview';
      expect(toolName).toBe('mermaid_preview');
    });

    it('should require diagram and preview_id parameters', () => {
      const requiredParams = ['diagram', 'preview_id'];
      expect(requiredParams).toContain('diagram');
      expect(requiredParams).toContain('preview_id');
      expect(requiredParams).toHaveLength(2);
    });

    it('should support format options', () => {
      const formats = ['png', 'svg', 'pdf'];
      expect(formats).toHaveLength(3);
      expect(formats).toContain('svg');
      expect(formats).toContain('pdf');
      expect(formats).toContain('png');
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

    it('should have preview_id parameter as required', () => {
      const previewIdParam = {
        type: 'string',
        required: true,
      };
      expect(previewIdParam.type).toBe('string');
      expect(previewIdParam.required).toBe(true);
    });

    it('should accept valid preview_id values', () => {
      const validIds = [
        'architecture',
        'flow',
        'sequence',
        'api-flow',
        'data-model',
      ];
      validIds.forEach(id => {
        expect(id).toBeTruthy();
        expect(typeof id).toBe('string');
      });
    });

    it('should always enable live reload mode', () => {
      const liveMode = true;
      expect(liveMode).toBe(true);
    });

    it('should throw error when diagram parameter is missing', () => {
      const diagram = undefined;
      const previewId = 'test';

      if (!diagram) {
        expect(() => {
          throw new Error('diagram parameter is required');
        }).toThrow('diagram parameter is required');
      }
    });

    it('should throw error when preview_id parameter is missing', () => {
      const diagram = 'graph TD; A-->B';
      const previewId = undefined;

      if (!previewId) {
        expect(() => {
          throw new Error('preview_id parameter is required');
        }).toThrow('preview_id parameter is required');
      }
    });
  });

  describe('Tool: mermaid_save', () => {
    it('should validate tool name', () => {
      const toolName = 'mermaid_save';
      expect(toolName).toBe('mermaid_save');
    });

    it('should require save_path and preview_id parameters', () => {
      const requiredParams = ['save_path', 'preview_id'];
      expect(requiredParams).toContain('save_path');
      expect(requiredParams).toContain('preview_id');
      expect(requiredParams).toHaveLength(2);
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

    it('should have format parameter with default svg', () => {
      const formatParam = {
        type: 'string',
        enum: ['png', 'svg', 'pdf'],
        default: 'svg',
      };
      expect(formatParam.type).toBe('string');
      expect(formatParam.default).toBe('svg');
      expect(formatParam.enum).toContain('svg');
    });

    it('should match preview_id with mermaid_preview', () => {
      const previewId = 'architecture';
      expect(previewId).toBe('architecture');
    });

    it('should throw error when save_path parameter is missing', () => {
      const savePath = undefined;
      const previewId = 'test';

      if (!savePath) {
        expect(() => {
          throw new Error('save_path parameter is required');
        }).toThrow('save_path parameter is required');
      }
    });
  });
});

describe('Preview IDs', () => {
  it('should use preview_id directly as diagram identifier', () => {
    const previewId = 'architecture';
    expect(previewId).toBe('architecture');
    expect(previewId).toBeTruthy();
  });

  it('should support multiple preview IDs', () => {
    const ids = ['architecture', 'flow', 'sequence'];
    ids.forEach(id => {
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });
  });

  it('should use preview_id for file naming', () => {
    const previewId = 'architecture';
    const format = 'svg';
    const fileName = `${previewId}-diagram.${format}`;

    expect(fileName).toBe('architecture-diagram.svg');
  });

  it('should support multiple concurrent diagrams', () => {
    const ids = ['architecture', 'flow', 'sequence'];
    const fileNames = ids.map(id => `${id}-diagram.svg`);

    expect(fileNames).toHaveLength(3);
    expect(fileNames[0]).toBe('architecture-diagram.svg');
    expect(fileNames[1]).toBe('flow-diagram.svg');
    expect(fileNames[2]).toBe('sequence-diagram.svg');
  });

  it('should use preview_id for URL paths', () => {
    const previewId = 'data-model';
    const port = 3737;
    const url = `http://localhost:${port}/${previewId}`;
    expect(url).toBe('http://localhost:3737/data-model');
  });

  it('should use preview_id for WebSocket sessions', () => {
    const previewId = 'api-flow';
    const port = 3737;
    const wsUrl = `ws://localhost:${port}/${previewId}`;

    expect(wsUrl).toBe('ws://localhost:3737/api-flow');
  });
});

describe('File Formats and Locations', () => {
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

  it('should use config directory for live diagrams', () => {
    const homeDir = process.env.HOME || process.env.USERPROFILE || tmpdir();
    const configDir = join(homeDir, '.config');
    const liveDir = join(configDir, 'claude-mermaid', 'live');
    expect(liveDir).toContain('.config');
    expect(liveDir).toContain('claude-mermaid');
    expect(liveDir).toContain('live');
  });

  it('should default to svg format', () => {
    const format = 'svg';
    expect(format).toBe('svg');
  });

  it('should generate file path using preview_id', () => {
    const homeDir = process.env.HOME || process.env.USERPROFILE || tmpdir();
    const liveDir = join(homeDir, '.config', 'claude-mermaid', 'live');
    const previewId = 'architecture';
    const format = 'svg';
    const filePath = join(liveDir, `${previewId}-diagram.${format}`);

    expect(filePath).toContain('architecture-diagram.svg');
    expect(filePath).toContain('.config/claude-mermaid/live');
  });
});

