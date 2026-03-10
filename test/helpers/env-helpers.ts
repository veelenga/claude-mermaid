import { mkdtemp, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { getPreviewDir } from "../../src/file-utils.js";

interface EnvSnapshot {
  home: string | undefined;
  xdgConfig: string | undefined;
  tempHome: string;
}

let snapshot: EnvSnapshot | null = null;

interface SetupOptions {
  setXdgConfig?: boolean;
}

export async function setupTestEnv(opts: SetupOptions = {}): Promise<string> {
  const { setXdgConfig = true } = opts;

  snapshot = {
    home: process.env.HOME,
    xdgConfig: process.env.XDG_CONFIG_HOME,
    tempHome: "",
  };

  const tempHome = await mkdtemp(join(tmpdir(), "claude-mermaid-test-home-"));
  snapshot.tempHome = tempHome;
  process.env.HOME = tempHome;

  if (setXdgConfig) {
    const tempConfigDir = join(tempHome, ".config");
    process.env.XDG_CONFIG_HOME = tempConfigDir;
    await mkdir(tempConfigDir, { recursive: true });
  } else {
    delete process.env.XDG_CONFIG_HOME;
  }

  return tempHome;
}

export async function setupTestEnvWithPreview(previewId: string): Promise<string> {
  await setupTestEnv();
  const testDir = getPreviewDir(previewId);
  await mkdir(testDir, { recursive: true });
  return testDir;
}

export async function restoreTestEnv(): Promise<void> {
  if (!snapshot) return;

  const { home, xdgConfig, tempHome } = snapshot;
  snapshot = null;

  if (home !== undefined) {
    process.env.HOME = home;
  } else {
    delete process.env.HOME;
  }

  if (xdgConfig !== undefined) {
    process.env.XDG_CONFIG_HOME = xdgConfig;
  } else {
    delete process.env.XDG_CONFIG_HOME;
  }

  await rm(tempHome, { recursive: true, force: true }).catch(() => {});
}
