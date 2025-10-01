import { readdir, unlink, stat, mkdir, readFile, writeFile, rmdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

export function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg && xdg.trim()) return xdg;
  const homeDir = process.env.HOME || process.env.USERPROFILE || tmpdir();
  return join(homeDir, ".config");
}

export function getLiveDir(): string {
  return join(getConfigDir(), "claude-mermaid", "live");
}

export function getPreviewDir(previewId: string): string {
  return join(getLiveDir(), previewId);
}

export function getDiagramFilePath(previewId: string, format: string): string {
  return join(getPreviewDir(previewId), `diagram.${format}`);
}

export function getDiagramSourcePath(previewId: string): string {
  return join(getPreviewDir(previewId), "diagram.mmd");
}

export function getDiagramOptionsPath(previewId: string): string {
  return join(getPreviewDir(previewId), "options.json");
}

export interface DiagramOptions {
  theme: string;
  background: string;
  width: number;
  height: number;
  scale: number;
}

export async function saveDiagramSource(
  previewId: string,
  diagram: string,
  options: DiagramOptions
): Promise<void> {
  const sourcePath = getDiagramSourcePath(previewId);
  const optionsPath = getDiagramOptionsPath(previewId);
  await writeFile(sourcePath, diagram, "utf-8");
  await writeFile(optionsPath, JSON.stringify(options, null, 2), "utf-8");
}

export async function loadDiagramSource(previewId: string): Promise<string> {
  const sourcePath = getDiagramSourcePath(previewId);
  return await readFile(sourcePath, "utf-8");
}

export async function loadDiagramOptions(previewId: string): Promise<DiagramOptions> {
  const optionsPath = getDiagramOptionsPath(previewId);
  const content = await readFile(optionsPath, "utf-8");
  return JSON.parse(content);
}

export async function cleanupOldDiagrams(
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000
): Promise<number> {
  try {
    const liveDir = getLiveDir();
    await mkdir(liveDir, { recursive: true });

    const entries = await readdir(liveDir, { withFileTypes: true });
    const now = Date.now();
    let cleanedCount = 0;

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = join(liveDir, entry.name);
        const sourcePath = join(dirPath, "diagram.mmd");

        try {
          const stats = await stat(sourcePath);
          const age = now - stats.mtimeMs;

          if (age > maxAgeMs) {
            const files = await readdir(dirPath);
            for (const file of files) {
              await unlink(join(dirPath, file));
            }
            await rmdir(dirPath);
            console.error(`Cleaned up old diagram: ${entry.name}`);
            cleanedCount++;
          }
        } catch (error) {
          // Ignore errors for individual directories
        }
      }
    }

    return cleanedCount;
  } catch (error) {
    console.error("Cleanup warning:", error instanceof Error ? error.message : String(error));
    return 0;
  }
}
