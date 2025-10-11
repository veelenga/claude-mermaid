import { vi } from "vitest";

interface Handler {
  (req: any, res: any): Promise<void> | void;
}

const state: {
  handler: Handler | null;
  port: number | null;
} = {
  handler: null,
  port: null,
};

class FakeServer {
  private events = new Map<string, (() => void) | undefined>();

  constructor(handler?: Handler) {
    if (handler) {
      state.handler = handler;
    }
  }

  once(event: string, callback: () => void) {
    this.events.set(event, callback);
  }

  listen(port: number, callback?: () => void) {
    state.port = port;
    callback?.();
    this.events.get("listening")?.();
  }

  close(callback?: () => void) {
    callback?.();
  }
}

vi.mock("http", () => ({
  createServer(handler?: Handler) {
    return new FakeServer(handler);
  },
}));

vi.mock("ws", () => ({
  WebSocketServer: class {
    on() {}
    close(callback?: () => void) {
      callback?.();
    }
  },
}));

export function resetServerState() {
  state.handler = null;
  state.port = null;
}

export function getRequestHandler(): Handler {
  if (!state.handler) {
    throw new Error("Live server not initialised. Call ensureLiveServer() first.");
  }
  return state.handler;
}

export function createRequestResponse(url: string) {
  const path = url.replace(/^https?:\/\/[^/]+/, "");
  const req = { url: path || "/" };
  let statusCode = 200;
  const headers = new Map<string, string>();
  let body = "";

  let resolveResult: (result: {
    statusCode: number;
    headers: Map<string, string>;
    body: string;
  }) => void;

  const completed = new Promise<{
    statusCode: number;
    headers: Map<string, string>;
    body: string;
  }>((resolve) => {
    resolveResult = resolve;
  });

  const res = {
    writeHead(code: number, headerBag: Record<string, string> = {}) {
      statusCode = code;
      for (const [key, value] of Object.entries(headerBag)) {
        headers.set(key.toLowerCase(), value);
      }
    },
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    end(chunk?: string | Buffer) {
      if (chunk) {
        body += chunk instanceof Buffer ? chunk.toString("utf-8") : chunk;
      }
      resolveResult({ statusCode, headers, body });
    },
  };

  return { req, res, completed };
}

export async function mockFetch(url: string) {
  const handler = getRequestHandler();
  const { req, res, completed } = createRequestResponse(url);
  await handler(req as any, res as any);
  const { statusCode, headers, body } = await completed;

  return {
    status: statusCode,
    headers: {
      get(name: string) {
        return headers.get(name.toLowerCase()) ?? null;
      },
    },
    async json() {
      return JSON.parse(body || "{}");
    },
    async text() {
      return body;
    },
  };
}
