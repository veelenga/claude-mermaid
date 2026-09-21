import { parseArgs } from "util";

export interface CliOptions {
  version: boolean;
  serve: boolean;
  preview?: string;
}

export function parseCliOptions(args: string[] = process.argv.slice(2)): CliOptions {
  const { values } = parseArgs({
    args,
    options: {
      version: { type: "boolean", short: "v", default: false },
      serve: { type: "boolean", default: false },
      preview: { type: "string" },
    },
  });
  return { version: values.version, serve: values.serve, preview: values.preview };
}
