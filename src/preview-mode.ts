import type { PreviewMode } from "./constants.js";
import { validatePreviewMode } from "./file-utils.js";

export const PREVIEW_MODE_ENV_VAR = "CLAUDE_MERMAID_PREVIEW";

export function resolvePreviewMode(value: string | undefined, fallback: PreviewMode): PreviewMode {
  const mode = value || fallback;
  validatePreviewMode(mode);
  return mode;
}
