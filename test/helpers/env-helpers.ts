import { mkdtemp, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { getPreviewDir } from "../../src/file-utils.js";

interface EnvSnapshot {
  home: string | undefined;
  xdgConfig: string | undefined;
}

let snapshot: EnvSnapshot | null = null;

export async function setupTestEnv(): Promise<string> {
  snapshot = {
    home: process.env.HOME,
    xdgConfig: process.env.XDG_CONFIG_HOME,
  };

  const tempHome = await mkdtemp(join(tmpdir(), "claude-mermaid-test-home-"));
  const tempConfigDir = join(tempHome, ".config");
  process.env.HOME = tempHome;
  process.env.XDG_CONFIG_HOME = tempConfigDir;
  await mkdir(tempConfigDir, { recursive: true });

  return tempHome;
}

export async function setupTestEnvWithPreview(previewId: string): Promise<string> {
  await setupTestEnv();
  const testDir = getPreviewDir(previewId);
  await mkdir(testDir, { recursive: true });
  return testDir;
}

export function restoreTestEnv(): void {
  if (!snapshot) return;

  if (snapshot.home !== undefined) {
    process.env.HOME = snapshot.home;
  } else {
    delete process.env.HOME;
  }

  if (snapshot.xdgConfig !== undefined) {
    process.env.XDG_CONFIG_HOME = snapshot.xdgConfig;
  } else {
    delete process.env.XDG_CONFIG_HOME;
  }

  snapshot = null;
}
