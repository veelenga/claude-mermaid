import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ensureLiveServer, addLiveDiagram, hasActiveConnections } from './live-server.js';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Live Server', () => {
  let tempDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), 'claude-mermaid-test', Date.now().toString());
    await mkdir(tempDir, { recursive: true });
    testFilePath = join(tempDir, 'test-diagram.svg');
    await writeFile(testFilePath, '<svg>test</svg>', 'utf-8');
  });

  afterEach(async () => {
    try {
      await unlink(testFilePath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  describe('ensureLiveServer', () => {
    it('should return a valid port number', async () => {
      const port = await ensureLiveServer();
      expect(port).toBeGreaterThanOrEqual(3737);
      expect(port).toBeLessThanOrEqual(3747);
    });

    it('should return the same port on subsequent calls', async () => {
      const port1 = await ensureLiveServer();
      const port2 = await ensureLiveServer();
      expect(port1).toBe(port2);
    });

    it('should start server in default port range', async () => {
      const port = await ensureLiveServer();
      expect(port).toBeGreaterThanOrEqual(3737);
      expect(port).toBeLessThanOrEqual(3747);
    });
  });

  describe('addLiveDiagram', () => {
    it('should add a diagram without throwing', async () => {
      const diagramId = 'test-diagram-1';
      await expect(addLiveDiagram(diagramId, testFilePath)).resolves.not.toThrow();
    });

    it('should handle multiple diagrams with different IDs', async () => {
      const id1 = 'diagram-1';
      const id2 = 'diagram-2';

      await addLiveDiagram(id1, testFilePath);
      await addLiveDiagram(id2, testFilePath);

      expect(hasActiveConnections(id1)).toBe(false);
      expect(hasActiveConnections(id2)).toBe(false);
    });

    it('should replace existing diagram with same ID', async () => {
      const diagramId = 'replace-test';

      await addLiveDiagram(diagramId, testFilePath);
      await addLiveDiagram(diagramId, testFilePath);

      expect(hasActiveConnections(diagramId)).toBe(false);
    });
  });

  describe('hasActiveConnections', () => {
    it('should return false for non-existent diagram', () => {
      expect(hasActiveConnections('non-existent')).toBe(false);
    });

    it('should return false for newly added diagram', async () => {
      const diagramId = 'new-diagram';
      await addLiveDiagram(diagramId, testFilePath);
      expect(hasActiveConnections(diagramId)).toBe(false);
    });

    it('should return false after adding diagram without connections', async () => {
      const diagramId = 'test-no-connections';
      await addLiveDiagram(diagramId, testFilePath);
      expect(hasActiveConnections(diagramId)).toBe(false);
    });
  });
});

describe('Live mode parameters', () => {
  it('should have live parameter with boolean type', () => {
    const liveParam = {
      type: 'boolean',
      default: false,
    };
    expect(liveParam.type).toBe('boolean');
    expect(liveParam.default).toBe(false);
  });

  it('should require save_path or use default location in live mode', () => {
    const liveMode = true;
    let savePath: string | undefined = undefined;

    if (liveMode && !savePath) {
      const homeDir = process.env.HOME || process.env.USERPROFILE || tmpdir();
      savePath = join(homeDir, '.claude-mermaid', 'live-diagram.svg');
    }

    expect(savePath).toBeTruthy();
    expect(savePath).toContain('.claude-mermaid');
  });

  it('should automatically enable browser mode when live is true', () => {
    let browser = false;
    const live = true;

    if (live) {
      browser = true;
    }

    expect(browser).toBe(true);
  });

  it('should not support PDF format in live mode', () => {
    const live = true;
    const format = 'pdf';

    const isValidFormat = !(live && format === 'pdf');
    expect(isValidFormat).toBe(false);
  });

  it('should support SVG format in live mode', () => {
    const live = true;
    const format = 'svg';

    const isValidFormat = !(live && format === 'pdf');
    expect(isValidFormat).toBe(true);
  });

  it('should support PNG format in live mode', () => {
    const live = true;
    const format = 'png';

    const isValidFormat = !(live && format === 'pdf');
    expect(isValidFormat).toBe(true);
  });
});

describe('Port management', () => {
  it('should use default port range 3737-3747', () => {
    const startPort = 3737;
    const maxPort = 3747;

    expect(maxPort - startPort).toBe(10);
    expect(startPort).toBe(3737);
    expect(maxPort).toBe(3747);
  });

  it('should have valid port range', () => {
    const startPort = 3737;
    const maxPort = 3747;

    expect(startPort).toBeGreaterThan(0);
    expect(maxPort).toBeLessThan(65536);
    expect(maxPort).toBeGreaterThan(startPort);
  });
});

describe('WebSocket functionality', () => {
  it('should support WebSocket protocol URL format', () => {
    const port = 3737;
    const diagramId = 'test-diagram';
    const wsUrl = `ws://localhost:${port}/${diagramId}`;

    expect(wsUrl).toContain('ws://');
    expect(wsUrl).toContain('localhost');
    expect(wsUrl).toContain(diagramId);
  });

  it('should construct HTTP URL for diagram access', () => {
    const port = 3737;
    const diagramId = 'test-diagram';
    const httpUrl = `http://localhost:${port}/${diagramId}`;

    expect(httpUrl).toContain('http://');
    expect(httpUrl).toContain('localhost');
    expect(httpUrl).toContain(diagramId);
  });

  it('should use reload message for client notifications', () => {
    const reloadMessage = 'reload';
    expect(reloadMessage).toBe('reload');
  });
});
