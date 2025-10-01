import { readdir, unlink, stat, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Get the live diagrams directory path
 */
export function getLiveDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || tmpdir();
  const configDir = join(homeDir, ".config");
  return join(configDir, "claude-mermaid", "live");
}

/**
 * Get the file path for a diagram
 */
export function getDiagramFilePath(previewId: string, format: string): string {
  const liveDir = getLiveDir();
  return join(liveDir, `${previewId}-diagram.${format}`);
}

/**
 * Clean up old diagram files (older than specified max age)
 * @param maxAgeMs Maximum age in milliseconds (default: 7 days)
 */
export async function cleanupOldDiagrams(
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000
): Promise<number> {
  try {
    const liveDir = getLiveDir();

    // Create directory if it doesn't exist
    await mkdir(liveDir, { recursive: true });

    const files = await readdir(liveDir);
    const now = Date.now();
    let cleanedCount = 0;

    for (const file of files) {
      if (
        file.endsWith("-diagram.svg") ||
        file.endsWith("-diagram.png") ||
        file.endsWith("-diagram.pdf")
      ) {
        const filePath = join(liveDir, file);
        try {
          const stats = await stat(filePath);
          const age = now - stats.mtimeMs;

          if (age > maxAgeMs) {
            await unlink(filePath);
            console.error(`Cleaned up old diagram: ${file}`);
            cleanedCount++;
          }
        } catch (error) {
          // Ignore errors for individual files
        }
      }
    }

    return cleanedCount;
  } catch (error) {
    // Ignore cleanup errors - don't fail operations
    console.error("Cleanup warning:", error instanceof Error ? error.message : String(error));
    return 0;
  }
}
