import { readdir, unlink, stat, mkdir, readFile, writeFile, rmdir } from "fs/promises";
import { join, resolve } from "path";
import { tmpdir } from "os";

const APP_NAME = "claude-mermaid";
const PREVIEW_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const UNIX_SYSTEM_PATHS = [
  "/etc",
  "/bin",
  "/sbin",
  "/usr/bin",
  "/usr/sbin",
  "/boot",
  "/sys",
  "/proc",
];

const WINDOWS_SYSTEM_PATHS = ["C:\\Windows", "C:\\Program Files"];

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
  return join(getAppDir(), "live");
}

export function getLogsDir(): string {
  return join(getAppDir(), "logs");
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

export const DEFAULT_DIAGRAM_OPTIONS: DiagramOptions = {
  theme: "default",
  background: "white",
  width: 800,
  height: 600,
  scale: 2,
};

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
