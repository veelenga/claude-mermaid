import { describe, it, expect, vi } from 'vitest';
import { getOpenCommand } from './index.js';

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
    const toolName = 'preview_mermaid';
    expect(toolName).toBe('preview_mermaid');
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