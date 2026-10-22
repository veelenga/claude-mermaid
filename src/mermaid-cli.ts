import { createRequire } from "module";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { RenderOptions } from "./types.js";

const MERMAID_CLI_PACKAGE = "@mermaid-js/mermaid-cli";
const MERMAID_CLI_BIN = "mmdc";
const PACKAGE_MANIFEST = "package.json";

type MermaidCliOptions = Pick<RenderOptions, "theme" | "background" | "size" | "scale">;

interface PackageManifest {
  bin?: string | Record<string, string>;
}

let cachedCliPath: string | undefined;

export function getMermaidCliPath(): string {
  cachedCliPath ??= resolveMermaidCliPath();
  return cachedCliPath;
}

export function buildMermaidCliArgs(
  inputFile: string,
  outputFile: string,
  options: MermaidCliOptions
): string[] {
  const args = [
    "-i",
    inputFile,
    "-o",
    outputFile,
    "-t",
    options.theme,
    "-b",
    options.background,
    "--size",
    options.size.toString(),
    "-s",
    options.scale.toString(),
  ];

  return args;
}

function resolveMermaidCliPath(): string {
  const packageRoot = findPackageRoot();
  const manifest: PackageManifest = JSON.parse(
    readFileSync(join(packageRoot, PACKAGE_MANIFEST), "utf-8")
  );
  const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[MERMAID_CLI_BIN];

  if (!bin) {
    throw new Error(`${MERMAID_CLI_PACKAGE} does not provide the ${MERMAID_CLI_BIN} binary`);
  }

  return join(packageRoot, bin);
}

function findPackageRoot(): string {
  const packageRoot = createRequire(import.meta.url)
    .resolve.paths(MERMAID_CLI_PACKAGE)
    ?.map((nodeModulesDir) => join(nodeModulesDir, MERMAID_CLI_PACKAGE))
    .find((dir) => existsSync(join(dir, PACKAGE_MANIFEST)));

  if (!packageRoot) {
    throw new Error(`Cannot find ${MERMAID_CLI_PACKAGE}. Reinstall claude-mermaid to restore it.`);
  }

  return packageRoot;
}
