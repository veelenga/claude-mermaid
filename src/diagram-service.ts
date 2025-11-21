/**
 * Diagram Service
 * Single Responsibility: Business logic for diagram data access and management
 */

import { readdir, stat } from "fs/promises";
import { join } from "path";
import {
  getLiveDir,
  validatePreviewId,
  getDiagramFilePath,
  deleteDiagram as deleteDiagramFiles,
} from "./file-utils.js";
import { DIAGRAM_FORMATS } from "./constants.js";
import { DiagramInfo } from "./types.js";
import { webLogger } from "./logger.js";

/**
 * Lists all diagrams in the live directory
 * @returns Array of diagram info sorted by modification time (newest first)
 */
export async function listDiagrams(): Promise<DiagramInfo[]> {
  try {
    const liveDir = getLiveDir();
    const entries = await readdir(liveDir, { withFileTypes: true });
    const diagrams: DiagramInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      try {
        // Validate the directory name is a valid preview ID
        validatePreviewId(entry.name);

        const info = await getDiagramInfo(entry.name);
        if (info) {
          diagrams.push(info);
        }
      } catch (error) {
        // Skip invalid or inaccessible diagrams
        webLogger.debug(`Skipping diagram directory: ${entry.name}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Sort by modification time (newest first)
    diagrams.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

    webLogger.debug(`Listed ${diagrams.length} diagrams`);
    return diagrams;
  } catch (error) {
    webLogger.error("Failed to list diagrams", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Gets detailed information about a specific diagram
 * @param previewId The diagram ID
 * @returns Diagram info or null if not found
 */
export async function getDiagramInfo(previewId: string): Promise<DiagramInfo | null> {
  try {
    validatePreviewId(previewId);

    // Try each format to find the diagram
    for (const format of Object.values(DIAGRAM_FORMATS)) {
      try {
        const filePath = getDiagramFilePath(previewId, format);
        const stats = await stat(filePath);

        return {
          id: previewId,
          format,
          modifiedAt: stats.mtime,
          sizeBytes: stats.size,
        };
      } catch {
        // Try next format
        continue;
      }
    }

    webLogger.debug(`Diagram not found: ${previewId}`);
    return null;
  } catch (error) {
    webLogger.error(`Error getting diagram info: ${previewId}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Searches diagrams by ID
 * @param query Search query (case-insensitive)
 * @returns Filtered array of diagram info
 */
export async function searchDiagrams(query: string): Promise<DiagramInfo[]> {
  if (!query || !query.trim()) {
    return listDiagrams();
  }

  const allDiagrams = await listDiagrams();
  const normalizedQuery = query.toLowerCase().trim();

  return allDiagrams.filter((diagram) => diagram.id.toLowerCase().includes(normalizedQuery));
}

/**
 * Checks if a diagram exists
 * @param previewId The diagram ID
 * @returns True if diagram exists
 */
export async function diagramExists(previewId: string): Promise<boolean> {
  try {
    validatePreviewId(previewId);
    const info = await getDiagramInfo(previewId);
    return info !== null;
  } catch {
    return false;
  }
}

/**
 * Gets the count of diagrams
 * @returns Total number of diagrams
 */
export async function getDiagramCount(): Promise<number> {
  const diagrams = await listDiagrams();
  return diagrams.length;
}

/**
 * Deletes a diagram and all its associated files
 * @param previewId The diagram ID
 */
export async function deleteDiagram(previewId: string): Promise<void> {
  try {
    validatePreviewId(previewId);

    // Check if diagram exists
    const info = await getDiagramInfo(previewId);
    if (!info) {
      throw new Error(`Diagram not found: ${previewId}`);
    }

    // Delete the diagram
    await deleteDiagramFiles(previewId);

    webLogger.info(`Deleted diagram: ${previewId}`);
  } catch (error) {
    webLogger.error(`Error deleting diagram: ${previewId}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
