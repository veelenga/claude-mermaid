import {
  DEFAULT_PREVIEW_BACKEND,
  PREVIEW_BACKENDS,
  PREVIEW_BACKEND_ENV_VAR,
  type PreviewBackendName,
} from "./constants.js";
import { validatePreviewBackend } from "./file-utils.js";
import type { PreviewBackend } from "./types.js";
import { LiveServerPreviewBackend } from "./live-preview-backend.js";
import { ArtifactPreviewBackend } from "./artifact-preview-backend.js";

export function resolvePreviewBackendName(
  requested: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): PreviewBackendName {
  const name = requested ?? env[PREVIEW_BACKEND_ENV_VAR] ?? DEFAULT_PREVIEW_BACKEND;
  validatePreviewBackend(name);
  return name;
}

export function createPreviewBackend(name: PreviewBackendName): PreviewBackend {
  switch (name) {
    case PREVIEW_BACKENDS.ARTIFACT:
      return new ArtifactPreviewBackend();
    case PREVIEW_BACKENDS.LIVE:
      return new LiveServerPreviewBackend();
  }
}
