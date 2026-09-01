import {
  ALLOWED_PREVIEW_BACKENDS,
  DEFAULT_PREVIEW_BACKEND,
  PREVIEW_BACKENDS,
  PREVIEW_BACKEND_ENV_VAR,
  PREVIEW_BACKEND_FLAG,
  type PreviewBackendName,
} from "./constants.js";
import type { PreviewBackend } from "./types.js";
import { LiveServerPreviewBackend } from "./live-preview-backend.js";
import { ArtifactPreviewBackend } from "./artifact-preview-backend.js";

function readFlagValue(argv: readonly string[]): string | undefined {
  const flagIndex = argv.indexOf(PREVIEW_BACKEND_FLAG);
  if (flagIndex !== -1) {
    return argv[flagIndex + 1];
  }
  const inline = argv.find((arg) => arg.startsWith(`${PREVIEW_BACKEND_FLAG}=`));
  return inline?.slice(PREVIEW_BACKEND_FLAG.length + 1);
}

function isPreviewBackendName(value: string): value is PreviewBackendName {
  return (ALLOWED_PREVIEW_BACKENDS as readonly string[]).includes(value);
}

export function resolvePreviewBackendName(
  argv: readonly string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env
): PreviewBackendName {
  const requested = readFlagValue(argv) ?? env[PREVIEW_BACKEND_ENV_VAR] ?? DEFAULT_PREVIEW_BACKEND;
  if (!isPreviewBackendName(requested)) {
    throw new Error(
      `Invalid preview backend: "${requested}". Allowed values: ${ALLOWED_PREVIEW_BACKENDS.join(", ")}.`
    );
  }
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
