/**
 * Unit tests for routes.ts
 * Tests HTTP route handling logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  matchRoute,
  handleGallery,
  handleApiDiagrams,
  handleSharedCss,
  handleGalleryCss,
  handleGalleryJs,
  ROUTE_CONFIG,
} from "../src/routes.js";
import { ROUTES } from "../src/constants.js";
import type { RouteContext } from "../src/types.js";
import { IncomingMessage, ServerResponse } from "http";
import * as pageRenderer from "../src/page-renderer.js";
import * as diagramService from "../src/diagram-service.js";
import { mkdir, writeFile, rmdir, unlink } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("Routes", () => {
  describe("matchRoute", () => {
    it("should match exact root route", () => {
      const route = matchRoute("/");
      expect(route).not.toBeNull();
      expect(route!.path).toBe(ROUTES.ROOT);
    });

    it("should match API diagrams route", () => {
      const route = matchRoute("/api/diagrams");
      expect(route).not.toBeNull();
      expect(route!.path).toBe(ROUTES.API_DIAGRAMS);
    });

    it("should match shared CSS route", () => {
      const route = matchRoute("/shared.css");
      expect(route).not.toBeNull();
      expect(route!.path).toBe(ROUTES.SHARED_STYLE);
    });

    it("should match gallery CSS route", () => {
      const route = matchRoute("/gallery.css");
      expect(route).not.toBeNull();
      expect(route!.path).toBe(ROUTES.GALLERY_STYLE);
    });

    it("should match gallery JS route", () => {
      const route = matchRoute("/gallery.js");
      expect(route).not.toBeNull();
      expect(route!.path).toBe(ROUTES.GALLERY_SCRIPT);
    });

    it("should return null for unmatched routes", () => {
      const route = matchRoute("/nonexistent");
      expect(route).toBeNull();
    });

    it("should not match similar but different routes", () => {
      const route = matchRoute("/api/diagram"); // Missing 's'
      expect(route).toBeNull();
    });

    it("should handle routes with query parameters", () => {
      // /api/diagrams uses non-exact matching, so query params are included
      // The handler is responsible for parsing and ignoring query params
      const routeWithQuery = matchRoute("/api/diagrams?search=test");
      expect(routeWithQuery).not.toBeNull();
      expect(routeWithQuery!.path).toBe(ROUTES.API_DIAGRAMS);

      // Without query params also matches
      const route = matchRoute("/api/diagrams");
      expect(route).not.toBeNull();
      expect(route!.path).toBe(ROUTES.API_DIAGRAMS);
    });
  });

  describe("ROUTE_CONFIG", () => {
    it("should have all required routes configured", () => {
      const paths = ROUTE_CONFIG.map((r) => r.path);
      expect(paths).toContain(ROUTES.ROOT);
      expect(paths).toContain(ROUTES.API_DIAGRAMS);
      expect(paths).toContain(ROUTES.SHARED_STYLE);
      expect(paths).toContain(ROUTES.GALLERY_STYLE);
      expect(paths).toContain(ROUTES.GALLERY_SCRIPT);
    });

    it("should have handlers for all routes", () => {
      ROUTE_CONFIG.forEach((route) => {
        expect(route.handler).toBeDefined();
        expect(typeof route.handler).toBe("function");
      });
    });

    it("should mark routes as exact match where appropriate", () => {
      const rootRoute = ROUTE_CONFIG.find((r) => r.path === ROUTES.ROOT);
      expect(rootRoute!.exact).toBe(true);
    });
  });

  describe("Handler Functions", () => {
    let mockReq: IncomingMessage;
    let mockRes: ServerResponse;
    let responseData: string;
    let responseHeaders: Record<string, string>;
    let statusCode: number;

    beforeEach(() => {
      // Create mock request
      mockReq = {
        url: "/",
        method: "GET",
        headers: {},
      } as IncomingMessage;

      // Create mock response with capturing methods
      responseData = "";
      responseHeaders = {};
      statusCode = 200;

      mockRes = {
        writeHead: vi.fn((code: number, headers?: Record<string, string>) => {
          statusCode = code;
          if (headers) {
            Object.assign(responseHeaders, headers);
          }
        }),
        end: vi.fn((data?: string) => {
          if (data) responseData += data;
        }),
        write: vi.fn((data: string) => {
          responseData += data;
        }),
      } as unknown as ServerResponse;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe("handleGallery", () => {
      it("should render gallery page with correct content type", async () => {
        vi.spyOn(pageRenderer, "renderPage").mockResolvedValue("<html>Gallery Page</html>");
        const context: RouteContext = { req: mockReq, res: mockRes, url: "/", port: 3737 };

        await handleGallery(context);

        expect(statusCode).toBe(200);
        expect(responseHeaders["Content-Type"]).toBe("text/html");
        expect(responseHeaders["Content-Security-Policy"]).toBeDefined();
        expect(responseData).toContain("Gallery Page");
      });

      it("should pass correct port to template", async () => {
        const renderSpy = vi.spyOn(pageRenderer, "renderPage").mockResolvedValue("<html></html>");
        const context: RouteContext = { req: mockReq, res: mockRes, url: "/", port: 3740 };

        await handleGallery(context);

        expect(renderSpy).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ PORT: 3740 }),
          expect.any(Object)
        );
      });

      it("should handle rendering errors gracefully", async () => {
        vi.spyOn(pageRenderer, "renderPage").mockRejectedValue(new Error("Template not found"));
        const context: RouteContext = { req: mockReq, res: mockRes, url: "/", port: 3737 };

        await handleGallery(context);

        expect(statusCode).toBe(500);
        expect(responseHeaders["Content-Type"]).toBe("text/plain");
        expect(responseData).toContain("Error loading gallery");
      });
    });

    describe("handleApiDiagrams", () => {
      it("should return JSON list of diagrams", async () => {
        const mockDiagrams = [
          {
            id: "test-1",
            format: "svg" as const,
            modifiedAt: new Date(),
            sizeBytes: 1024,
          },
          {
            id: "test-2",
            format: "png" as const,
            modifiedAt: new Date(),
            sizeBytes: 2048,
          },
        ];
        vi.spyOn(diagramService, "listDiagrams").mockResolvedValue(mockDiagrams);
        const context: RouteContext = {
          req: mockReq,
          res: mockRes,
          url: "/api/diagrams",
          port: 3737,
        };

        await handleApiDiagrams(context);

        expect(statusCode).toBe(200);
        expect(responseHeaders["Content-Type"]).toBe("application/json");
        expect(responseHeaders["Cache-Control"]).toBe("no-store");
        const json = JSON.parse(responseData);
        expect(json.diagrams).toHaveLength(2);
        expect(json.count).toBe(2);
        expect(json.diagrams[0].id).toBe("test-1");
      });

      it("should handle empty diagram list", async () => {
        vi.spyOn(diagramService, "listDiagrams").mockResolvedValue([]);
        const context: RouteContext = {
          req: mockReq,
          res: mockRes,
          url: "/api/diagrams",
          port: 3737,
        };

        await handleApiDiagrams(context);

        expect(statusCode).toBe(200);
        const json = JSON.parse(responseData);
        expect(json.diagrams).toEqual([]);
        expect(json.count).toBe(0);
      });

      it("should handle service errors gracefully", async () => {
        vi.spyOn(diagramService, "listDiagrams").mockRejectedValue(new Error("Database error"));
        const context: RouteContext = {
          req: mockReq,
          res: mockRes,
          url: "/api/diagrams",
          port: 3737,
        };

        await handleApiDiagrams(context);

        expect(statusCode).toBe(500);
        expect(responseHeaders["Content-Type"]).toBe("application/json");
        const json = JSON.parse(responseData);
        expect(json.error).toBe("Failed to list diagrams");
      });
    });

    describe("Static Asset Handlers", () => {
      it("handleSharedCss should serve CSS file", async () => {
        const context: RouteContext = {
          req: mockReq,
          res: mockRes,
          url: "/shared.css",
          port: 3737,
        };

        await handleSharedCss(context);

        expect(statusCode).toBe(200);
        expect(responseHeaders["Content-Type"]).toBe("text/css");
        expect(responseData).toContain("/* ===== Base Styles ===== */");
        expect(responseData).toContain("body {");
      });

      it("handleGalleryCss should serve CSS file", async () => {
        const context: RouteContext = {
          req: mockReq,
          res: mockRes,
          url: "/gallery.css",
          port: 3737,
        };

        await handleGalleryCss(context);

        expect(statusCode).toBe(200);
        expect(responseHeaders["Content-Type"]).toBe("text/css");
        expect(responseData).toContain(".gallery-grid");
        expect(responseData).toContain("grid-template-columns");
      });

      it("handleGalleryJs should serve JavaScript file", async () => {
        const context: RouteContext = {
          req: mockReq,
          res: mockRes,
          url: "/gallery.js",
          port: 3737,
        };

        await handleGalleryJs(context);

        expect(statusCode).toBe(200);
        expect(responseHeaders["Content-Type"]).toBe("application/javascript");
        expect(responseData).toContain("function renderGallery");
        expect(responseData).toContain("loadDiagrams");
      });
    });
  });
});
