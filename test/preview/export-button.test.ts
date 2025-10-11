import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JSDOM } from "jsdom";

const HTML_TEMPLATE = `
  <!doctype html>
  <html>
    <body data-diagram-id="example" data-port="3737" data-live-enabled="true">
      <div class="viewport"></div>
      <span id="status-text"></span>
      <span id="status-indicator"></span>
      <button id="reset-pan"></button>
      <button id="open-mermaid-live">Open</button>
    </body>
  </html>
`;

describe("Preview export button", () => {
  let dom: JSDOM;
  let fetchMock: ReturnType<typeof vi.fn>;
  let openMock: ReturnType<typeof vi.fn>;
  let alertMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Create JSDOM instance with runScripts enabled
    dom = new JSDOM(HTML_TEMPLATE, {
      url: "http://localhost:3737/preview",
      pretendToBeVisual: true,
      runScripts: "dangerously",
    });

    const { window } = dom;

    fetchMock = vi.fn();
    openMock = vi.fn();
    alertMock = vi.fn();

    // Set up mocks in the window context
    window.fetch = fetchMock as any;
    window.open = openMock as any;
    window.alert = alertMock as any;

    class MockWebSocket {
      onopen?: () => void;
      onclose?: () => void;
      onerror?: () => void;

      constructor() {
        setTimeout(() => this.onopen?.(), 0);
      }

      close() {
        this.onclose?.();
      }

      addEventListener() {}

      removeEventListener() {}
    }

    window.WebSocket = MockWebSocket as any;

    // Load and execute the script in the JSDOM window context
    const { readFileSync } = await import("fs");
    const scriptContent = readFileSync("./src/preview/script.js", "utf-8");
    const scriptEl = window.document.createElement("script");
    scriptEl.textContent = scriptContent;
    window.document.head.appendChild(scriptEl);

    // Give time for script to initialize
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  afterEach(() => {
    dom.window.close();
    vi.restoreAllMocks();
  });

  it("opens Mermaid Live URL and toggles loading state", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: "https://mermaid.live/edit#pako:test" }),
    });

    const button = dom.window.document.getElementById("open-mermaid-live") as HTMLButtonElement;
    button.click();

    expect(button.disabled).toBe(true);
    expect(button.classList.contains("is-loading")).toBe(true);

    await vi.waitFor(() => {
      expect(openMock).toHaveBeenCalledWith(
        "https://mermaid.live/edit#pako:test",
        "_blank",
        "noopener,noreferrer"
      );
    });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3737/mermaid-live/example");
    expect(button.disabled).toBe(false);
    expect(button.classList.contains("is-loading")).toBe(false);
  });

  it("shows alert on error and re-enables button", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const button = dom.window.document.getElementById("open-mermaid-live") as HTMLButtonElement;
    button.click();

    await vi.waitFor(() => {
      expect(alertMock).toHaveBeenCalled();
    });

    expect(button.disabled).toBe(false);
    expect(button.classList.contains("is-loading")).toBe(false);
  });
});
