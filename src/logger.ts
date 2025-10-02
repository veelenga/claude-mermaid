import { appendFile, mkdir } from "fs/promises";
import { join } from "path";
import { getLogsDir } from "./file-utils.js";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  OFF = 4,
}

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.INFO]: "INFO",
  [LogLevel.WARN]: "WARN",
  [LogLevel.ERROR]: "ERROR",
  [LogLevel.OFF]: "OFF",
};

function parseLogLevel(level?: string): LogLevel {
  if (!level) return LogLevel.INFO;

  const normalized = level.toUpperCase();
  switch (normalized) {
    case "DEBUG":
      return LogLevel.DEBUG;
    case "INFO":
      return LogLevel.INFO;
    case "WARN":
      return LogLevel.WARN;
    case "ERROR":
      return LogLevel.ERROR;
    case "OFF":
      return LogLevel.OFF;
    default:
      return LogLevel.INFO;
  }
}

class Logger {
  private logFilePath: string;
  private logsDir: string;
  private minLogLevel: LogLevel;

  constructor(logFileName: string, baseDir?: string) {
    this.logsDir = baseDir || getLogsDir();
    this.logFilePath = join(this.logsDir, logFileName);
    this.minLogLevel = parseLogLevel(process.env.CLAUDE_MERMAID_LOG_LEVEL);
  }

  private async ensureLogDir(): Promise<void> {
    await mkdir(this.logsDir, { recursive: true });
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const levelName = LOG_LEVEL_NAMES[level];
    const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : "";
    return `[${timestamp}] ${levelName}: ${message}${dataStr}\n`;
  }

  private async log(level: LogLevel, message: string, data?: unknown): Promise<void> {
    // Check if this log level should be written
    if (level < this.minLogLevel) return;

    try {
      await this.ensureLogDir();
      const formatted = this.formatMessage(level, message, data);
      await appendFile(this.logFilePath, formatted);
    } catch (error) {
      // Silently fail to avoid disrupting the main application
      console.error("Logger error:", error);
    }
  }

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data);
  }
}

export const mcpLogger = new Logger("mcp.log");
export const webLogger = new Logger("web.log");

// For testing: create loggers with custom base directory
export function createTestLoggers(baseDir: string) {
  return {
    mcpLogger: new Logger("mcp.log", baseDir),
    webLogger: new Logger("web.log", baseDir),
  };
}
