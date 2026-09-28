import { describe, it, expect } from "vitest";
import { execFile } from "child_process";
import { existsSync } from "fs";
import { sep } from "path";
import { promisify } from "util";
import { buildMermaidCliArgs, getMermaidCliPath } from "../src/mermaid-cli.js";
import { DEFAULT_DIAGRAM_OPTIONS } from "../src/constants.js";

const execFileAsync = promisify(execFile);

const HELP_TIMEOUT_MS = 30_000;
const OPTION_LINE_REGEX = /^\s+-/;
const OPTION_SIGNATURE_SEPARATOR = /\s{2,}/;
const FLAG_REGEX = /--?[a-zA-Z][\w-]*/g;

function buildArgs(format: string): string[] {
  return buildMermaidCliArgs("in.mmd", `out.${format}`, { ...DEFAULT_DIAGRAM_OPTIONS, format });
}

function parseSupportedFlags(help: string): Set<string> {
  const flags = help
    .split("\n")
    .filter((line) => OPTION_LINE_REGEX.test(line))
    .flatMap((line) => line.trim().split(OPTION_SIGNATURE_SEPARATOR)[0].match(FLAG_REGEX) ?? []);
  return new Set(flags);
}

describe("getMermaidCliPath", () => {
  it("should resolve the mmdc script of the bundled mermaid-cli", () => {
    const cliPath = getMermaidCliPath();

    expect(existsSync(cliPath)).toBe(true);
    expect(cliPath).toContain(["@mermaid-js", "mermaid-cli"].join(sep));
  });
});

describe("buildMermaidCliArgs", () => {
  it("should pass input, output and render options", () => {
    const args = buildMermaidCliArgs("in.mmd", "out.svg", {
      format: "svg",
      theme: "dark",
      background: "transparent",
      width: 1024,
      height: 768,
      scale: 2,
    });

    expect(args).toEqual([
      "-i",
      "in.mmd",
      "-o",
      "out.svg",
      "-t",
      "dark",
      "-b",
      "transparent",
      "-w",
      "1024",
      "-H",
      "768",
      "-s",
      "2",
    ]);
  });

  it("should fit the page to the diagram only for pdf", () => {
    expect(buildArgs("pdf")).toContain("--pdfFit");
    expect(buildArgs("svg")).not.toContain("--pdfFit");
  });

  it(
    "should only use flags supported by the bundled mermaid-cli",
    async () => {
      const { stdout } = await execFileAsync(process.execPath, [getMermaidCliPath(), "--help"]);
      const supportedFlags = parseSupportedFlags(stdout);
      const usedFlags = buildArgs("pdf").filter((arg) => arg.startsWith("-"));

      expect(supportedFlags.size).toBeGreaterThan(0);
      expect(usedFlags.filter((flag) => !supportedFlags.has(flag))).toEqual([]);
    },
    HELP_TIMEOUT_MS
  );
});
