import { readdir, unlink, stat, mkdir, readFile, writeFile, rmdir } from "fs/promises";
import { join, resolve } from "path";
import { tmpdir } from "os";
import {
  APP_NAME,
  PREVIEW_ID_REGEX,
  UNIX_SYSTEM_PATHS,
  WINDOWS_SYSTEM_PATHS,
  TIMEOUTS,
  FILE_NAMES,
  DIR_NAMES,
} from "./constants.js";
import type { DiagramOptions } from "./types.js";

export function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg && xdg.trim()) return xdg;
  const homeDir = process.env.HOME || process.env.USERPROFILE || tmpdir();
  return join(homeDir, ".config");
}

export function getAppDir(): string {
  return join(getConfigDir(), APP_NAME);
}

export function getLiveDir(): string {
  return join(getAppDir(), DIR_NAMES.LIVE);
}

export function getLogsDir(): string {
  return join(getAppDir(), DIR_NAMES.LOGS);
}

/**
 * Validates that previewId is safe to use in file paths
 * Only allows alphanumeric characters, hyphens, and underscores
 */
export function validatePreviewId(previewId: string): void {
  if (!previewId || !PREVIEW_ID_REGEX.test(previewId)) {
    throw new Error(
      "Invalid preview ID format. Only alphanumeric characters, hyphens, and underscores are allowed."
    );
  }
}

export function getPreviewDir(previewId: string): string {
  validatePreviewId(previewId);
  return join(getLiveDir(), previewId);
}

export function getDiagramFilePath(previewId: string, format: string): string {
  return join(getPreviewDir(previewId), `diagram.${format}`);
}

export function getDiagramSourcePath(previewId: string): string {
  return join(getPreviewDir(previewId), FILE_NAMES.DIAGRAM_SOURCE);
}

export function getDiagramOptionsPath(previewId: string): string {
  return join(getPreviewDir(previewId), FILE_NAMES.DIAGRAM_OPTIONS);
}

// Re-export DiagramOptions type from types.ts for backward compatibility
export type { DiagramOptions } from "./types.js";

// Re-export DEFAULT_DIAGRAM_OPTIONS from constants.ts for backward compatibility
export { DEFAULT_DIAGRAM_OPTIONS } from "./constants.js";

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

/**
 * Validates a save path to prevent path traversal and writing to sensitive locations
 * @param savePath - The path where the user wants to save the file
 * @throws Error if the path is invalid or dangerous
 */
export function validateSavePath(savePath: string): void {
  // Check for null bytes (potential security issue)
  if (savePath.includes("\0")) {
    throw new Error("Path contains null bytes");
  }

  // Resolve to absolute path
  const absolutePath = resolve(savePath);

  // Prevent writing to sensitive system directories (Unix/Linux/macOS)
  if (
    process.platform !== "win32" &&
    UNIX_SYSTEM_PATHS.some((danger) => absolutePath.startsWith(danger))
  ) {
    throw new Error("Cannot write to system directories");
  }

  // Prevent writing to Windows system directories
  if (process.platform === "win32") {
    const normalizedPath = absolutePath.replace(/\//g, "\\");
    if (WINDOWS_SYSTEM_PATHS.some((danger) => normalizedPath.startsWith(danger))) {
      throw new Error("Cannot write to system directories");
    }
  }
}

export async function cleanupOldDiagrams(
  maxAgeMs: number = TIMEOUTS.CLEANUP_MAX_AGE_MS
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
        const sourcePath = join(dirPath, FILE_NAMES.DIAGRAM_SOURCE);

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
