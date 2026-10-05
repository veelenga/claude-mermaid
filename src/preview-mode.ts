import { DEFAULT_PREVIEW_MODE, type PreviewMode } from "./constants.js";
import { validatePreviewMode } from "./file-utils.js";

const PREVIEW_FLAG = "--preview";
const PREVIEW_ENV_VAR = "CLAUDE_MERMAID_PREVIEW";

export function resolvePreviewMode(argv: string[], env: NodeJS.ProcessEnv): PreviewMode {
  const flagIndex = argv.indexOf(PREVIEW_FLAG);
  const mode =
    (flagIndex >= 0 ? argv[flagIndex + 1] : env[PREVIEW_ENV_VAR]) || DEFAULT_PREVIEW_MODE;
  validatePreviewMode(mode);
  return mode;
}
