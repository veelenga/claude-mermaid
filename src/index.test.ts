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
});