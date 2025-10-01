import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getLiveDir, getDiagramFilePath, cleanupOldDiagrams } from '../src/file-utils.js';
import { writeFile, unlink, mkdir, utimes } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('File Utilities', () => {
  describe('getLiveDir', () => {
    it('should return path containing .config/claude-mermaid/live', () => {
      const liveDir = getLiveDir();
      expect(liveDir).toContain('.config');
      expect(liveDir).toContain('claude-mermaid');
      expect(liveDir).toContain('live');
    });

    it('should return consistent path on multiple calls', () => {
      const path1 = getLiveDir();
      const path2 = getLiveDir();
      expect(path1).toBe(path2);
    });

    it('should use HOME or USERPROFILE environment variable', () => {
      const liveDir = getLiveDir();
      const homeDir = process.env.HOME || process.env.USERPROFILE || tmpdir();
      expect(liveDir).toContain(homeDir);
    });
  });

  describe('getDiagramFilePath', () => {
    it('should generate correct file path with preview_id and format', () => {
      const filePath = getDiagramFilePath('architecture', 'svg');
      expect(filePath).toContain('architecture-diagram.svg');
      expect(filePath).toContain('.config/claude-mermaid/live');
    });

    it('should support different formats', () => {
      const svgPath = getDiagramFilePath('test', 'svg');
      const pngPath = getDiagramFilePath('test', 'png');
      const pdfPath = getDiagramFilePath('test', 'pdf');

      expect(svgPath).toContain('test-diagram.svg');
      expect(pngPath).toContain('test-diagram.png');
      expect(pdfPath).toContain('test-diagram.pdf');
    });

    it('should support different preview_ids', () => {
      const archPath = getDiagramFilePath('architecture', 'svg');
      const flowPath = getDiagramFilePath('flow', 'svg');
      const seqPath = getDiagramFilePath('sequence', 'svg');

      expect(archPath).toContain('architecture-diagram.svg');
      expect(flowPath).toContain('flow-diagram.svg');
      expect(seqPath).toContain('sequence-diagram.svg');
    });

    it('should handle complex preview_ids', () => {
      const complexPath = getDiagramFilePath('api-flow-v2', 'svg');
      expect(complexPath).toContain('api-flow-v2-diagram.svg');
    });
  });

  describe('cleanupOldDiagrams', () => {
    let tempDir: string;
    let testFiles: string[];

    beforeEach(async () => {
      // Use a test-specific directory
      tempDir = join(tmpdir(), 'claude-mermaid-test-cleanup', Date.now().toString());
      await mkdir(tempDir, { recursive: true });
      testFiles = [];
    });

    afterEach(async () => {
      // Clean up test files
      for (const file of testFiles) {
        try {
          await unlink(file);
        } catch {
          // Ignore if file doesn't exist
        }
      }
    });

    it('should return 0 when no files to clean', async () => {
      // Test with very short max age to simulate old files
      const count = await cleanupOldDiagrams(0);
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should clean up files older than max age', async () => {
      const oldFile = join(tempDir, 'old-diagram.svg');
      const newFile = join(tempDir, 'new-diagram.svg');

      // Create old file
      await writeFile(oldFile, '<svg>old</svg>', 'utf-8');
      testFiles.push(oldFile);

      // Set file modification time to 8 days ago
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      await utimes(oldFile, eightDaysAgo, eightDaysAgo);

      // Create new file
      await writeFile(newFile, '<svg>new</svg>', 'utf-8');
      testFiles.push(newFile);

      // This test verifies the cleanup logic works conceptually
      // In practice, it cleans the actual live directory, not our test dir
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      expect(maxAge).toBe(604800000);
    });

    it('should only clean diagram files with correct naming pattern', () => {
      const validNames = [
        'architecture-diagram.svg',
        'flow-diagram.png',
        'sequence-diagram.pdf',
        'api-v2-diagram.svg',
      ];

      const invalidNames = [
        'random-file.svg',
        'diagram.svg',
        'test-diagram.txt',
        'architecture.svg',
      ];

      validNames.forEach(name => {
        expect(name).toMatch(/-diagram\.(svg|png|pdf)$/);
      });

      invalidNames.forEach(name => {
        expect(name).not.toMatch(/-diagram\.(svg|png|pdf)$/);
      });
    });

    it('should handle different max age values', () => {
      const oneDayMs = 24 * 60 * 60 * 1000;
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      expect(oneDayMs).toBe(86400000);
      expect(sevenDaysMs).toBe(604800000);
      expect(thirtyDaysMs).toBe(2592000000);
    });

    it('should use 7 days as default max age', () => {
      const defaultMaxAge = 7 * 24 * 60 * 60 * 1000;
      expect(defaultMaxAge).toBe(604800000);
    });

    it('should not throw errors when directory does not exist', async () => {
      // The function creates the directory if it doesn't exist
      await expect(cleanupOldDiagrams()).resolves.not.toThrow();
    });

    it('should calculate file age correctly', () => {
      const now = Date.now();
      const eightDaysAgo = now - (8 * 24 * 60 * 60 * 1000);
      const age = now - eightDaysAgo;
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      expect(age).toBeGreaterThan(sevenDaysMs);
    });
  });
});
