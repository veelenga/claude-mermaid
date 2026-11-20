import { DEFAULT_PREVIEW_MODE, type PreviewMode } from "./constants.js";
import { validatePreviewMode } from "./file-utils.js";

export const PREVIEW_MODE_ENV_VAR = "CLAUDE_MERMAID_PREVIEW";

export function resolveDefaultPreviewMode(env: NodeJS.ProcessEnv): PreviewMode {
  const mode = env[PREVIEW_MODE_ENV_VAR] || DEFAULT_PREVIEW_MODE;
  validatePreviewMode(mode);
  return mode;
}
