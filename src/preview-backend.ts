import {
  DEFAULT_PREVIEW_BACKEND,
  PREVIEW_BACKENDS,
  PREVIEW_BACKEND_ENV_VAR,
  PREVIEW_BACKEND_FLAG,
  type PreviewBackendName,
} from "./constants.js";
import { validatePreviewBackend } from "./file-utils.js";
import type { PreviewBackend } from "./types.js";
import { LiveServerPreviewBackend } from "./live-preview-backend.js";
import { ArtifactPreviewBackend } from "./artifact-preview-backend.js";

function readFlagValue(argv: readonly string[]): string | undefined {
  const flagIndex = argv.indexOf(PREVIEW_BACKEND_FLAG);
  return flagIndex === -1 ? undefined : argv[flagIndex + 1];
}

export function resolvePreviewBackendName(
  argv: readonly string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env
): PreviewBackendName {
  const requested = readFlagValue(argv) ?? env[PREVIEW_BACKEND_ENV_VAR] ?? DEFAULT_PREVIEW_BACKEND;
  validatePreviewBackend(requested);
  return requested;
}

export function createPreviewBackend(
  name: PreviewBackendName = resolvePreviewBackendName()
): PreviewBackend {
  switch (name) {
    case PREVIEW_BACKENDS.ARTIFACT:
      return new ArtifactPreviewBackend();
    case PREVIEW_BACKENDS.LIVE:
      return new LiveServerPreviewBackend();
  }
}
