/**
 * TypeScript type definitions for claude-mermaid
 */

import { IncomingMessage, ServerResponse } from "http";
import { DiagramFormat } from "./constants.js";

// ===== Diagram Types =====

export interface DiagramOptions {
  theme: string;
  background: string;
  width: number;
  height: number;
  scale: number;
}

export interface DiagramInfo {
  id: string;
  format: DiagramFormat;
  modifiedAt: Date;
  sizeBytes: number;
}

export interface DiagramDetails extends DiagramInfo {
  source: string;
  options: DiagramOptions;
}

// ===== Route Types =====

export interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: string;
  port: number;
}

export type RouteHandler = (context: RouteContext) => Promise<void>;

export interface RouteDefinition {
  path: string;
  handler: RouteHandler;
  method?: "GET" | "POST" | "PUT" | "DELETE";
}

// ===== Page Rendering Types =====

export interface PageData {
  [key: string]: string | number | boolean | undefined;
}

export interface PageRenderOptions {
  title?: string;
  styles?: string[];
  scripts?: string[];
  includeNav?: boolean;
  includeFooter?: boolean;
}

// ===== Gallery Types =====

export interface GalleryData {
  diagrams: DiagramInfo[];
  totalCount: number;
}

// ===== API Response Types =====

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DiagramListResponse {
  diagrams: DiagramInfo[];
  count: number;
}

// ===== WebSocket Types =====

export interface DiagramState {
  filePath: string;
  watcher: import("fs").FSWatcher;
  clients: Set<import("ws").WebSocket>;
}
