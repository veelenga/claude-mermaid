/**
 * Standalone server mode (--serve)
 * Starts the live server without the MCP stdio transport,
 * registers existing diagrams, and opens the gallery in the browser.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { readdir, access } from "fs/promises";
import { join } from "path";
import { ensureLiveServer, addLiveDiagram } from "./live-server.js";
import { getLiveDir, getOpenCommand } from "./file-utils.js";
import { FILE_NAMES } from "./constants.js";

const execFileAsync = promisify(execFile);

async function registerExistingDiagrams(): Promise<number> {
  const liveDir = getLiveDir();
  let registered = 0;

  let entries;
  try {
    entries = await readdir(liveDir, { withFileTypes: true });
  } catch {
    return 0;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const svgPath = join(liveDir, entry.name, FILE_NAMES.DIAGRAM_SVG);
    try {
      await access(svgPath);
      await addLiveDiagram(entry.name, svgPath);
      registered++;
    } catch {
      // Skip directories without a rendered SVG
    }
  }

  return registered;
}

export async function startServeMode(): Promise<void> {
  const diagramCount = await registerExistingDiagrams();
  const port = await ensureLiveServer();
  const galleryUrl = `http://localhost:${port}/`;

  console.log(`Serving ${diagramCount} diagram(s) at ${galleryUrl}`);

  // Opening the browser is best-effort — a failure must not bring down
  // `--serve`. On Windows, `getOpenCommand()` returns `start`, a cmd.exe
  // builtin that `execFile` cannot launch directly; route through `cmd /c`.
  try {
    if (process.platform === "win32") {
      await execFileAsync("cmd.exe", ["/c", "start", "", galleryUrl]);
    } else {
      await execFileAsync(getOpenCommand(), [galleryUrl]);
    }
  } catch {
    // Ignored — server is up; the user can navigate to the URL manually.
  }
}
