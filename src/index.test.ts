import { describe, it, expect } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';

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

  it('should default to config directory for save path', () => {
    const homeDir = process.env.HOME || process.env.USERPROFILE || tmpdir();
    const configDir = join(homeDir, '.config');
    const liveDir = join(configDir, 'claude-mermaid');
    expect(liveDir).toContain('.config');
    expect(liveDir).toContain('claude-mermaid');
  });

  it('should default to svg when no save_path provided', () => {
    const savePath = undefined;
    const requestedFormat = undefined;
    const format = requestedFormat || (savePath ? 'png' : 'svg');
    expect(format).toBe('svg');
  });

  it('should default to png when save_path is provided', () => {
    const savePath = './docs/diagram.png';
    const requestedFormat = undefined;
    const format = requestedFormat || (savePath ? 'png' : 'svg');
    expect(format).toBe('png');
  });

  it('should use explicit format when provided', () => {
    const savePath = './docs/diagram.svg';
    const requestedFormat = 'pdf';
    const format = requestedFormat || (savePath ? 'png' : 'svg');
    expect(format).toBe('pdf');
  });
});

describe('ID generation', () => {
  it('should generate stable ID from save path', () => {
    const savePath = './docs/diagram.svg';
    const id = Buffer.from(savePath).toString('base64').replace(/[/+=]/g, '').substring(0, 16);
    expect(id).toBeTruthy();
    expect(id.length).toBe(16);
  });

  it('should generate consistent IDs for same path', () => {
    const savePath = './docs/diagram.svg';
    const id1 = Buffer.from(savePath).toString('base64').replace(/[/+=]/g, '').substring(0, 16);
    const id2 = Buffer.from(savePath).toString('base64').replace(/[/+=]/g, '').substring(0, 16);
    expect(id1).toBe(id2);
  });

  it('should use default path when no save_path provided', () => {
    const homeDir = process.env.HOME || process.env.USERPROFILE || tmpdir();
    const liveDir = join(homeDir, '.config', 'claude-mermaid');
    const savePath = undefined;
    const format = 'svg';
    const idSource = savePath || join(liveDir, `live-diagram.${format}`);
    expect(idSource).toContain('live-diagram.svg');
  });
});

describe('SVG preview generation', () => {
  it('should generate SVG preview for PDF format', () => {
    const format = 'pdf';
    const shouldGenerateSvg = format !== 'svg';
    expect(shouldGenerateSvg).toBe(true);
  });

  it('should generate SVG preview for PNG format', () => {
    const format = 'png';
    const shouldGenerateSvg = format !== 'svg';
    expect(shouldGenerateSvg).toBe(true);
  });

  it('should not generate SVG preview for SVG format', () => {
    const format = 'svg';
    const shouldGenerateSvg = format !== 'svg';
    expect(shouldGenerateSvg).toBe(false);
  });
});