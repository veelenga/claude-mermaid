import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { LogLevel, mcpLogger, webLogger, createTestLoggers } from "../src/logger.js";
import { getLogsDir } from "../src/file-utils.js";
import { readFile, mkdir, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

describe("Logger", () => {
  let testLogsDir: string;
  let testMcpLogger: ReturnType<typeof createTestLoggers>["mcpLogger"];
  let testWebLogger: ReturnType<typeof createTestLoggers>["webLogger"];
  let originalLogLevel: string | undefined;

  beforeAll(async () => {
    originalLogLevel = process.env.CLAUDE_MERMAID_LOG_LEVEL;
    // Enable logging for logger tests (setup.ts sets it to OFF)
    process.env.CLAUDE_MERMAID_LOG_LEVEL = "INFO";
    testLogsDir = await mkdtemp(join(tmpdir(), "claude-mermaid-test-logs-"));
    const loggers = createTestLoggers(testLogsDir);
    testMcpLogger = loggers.mcpLogger;
    testWebLogger = loggers.webLogger;
  });

  afterAll(() => {
    if (originalLogLevel) {
      process.env.CLAUDE_MERMAID_LOG_LEVEL = originalLogLevel;
    } else {
      delete process.env.CLAUDE_MERMAID_LOG_LEVEL;
    }
  });

  describe("Log Levels", () => {
    it("should have correct numeric values", () => {
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
      expect(LogLevel.OFF).toBe(4);
    });

    it("should order from most to least verbose", () => {
      expect(LogLevel.DEBUG).toBeLessThan(LogLevel.INFO);
      expect(LogLevel.INFO).toBeLessThan(LogLevel.WARN);
      expect(LogLevel.WARN).toBeLessThan(LogLevel.ERROR);
      expect(LogLevel.ERROR).toBeLessThan(LogLevel.OFF);
    });
  });

  describe("Logger instances", () => {
    it("should create mcpLogger and webLogger", () => {
      expect(mcpLogger).toBeDefined();
      expect(webLogger).toBeDefined();
      expect(mcpLogger.info).toBeDefined();
      expect(webLogger.info).toBeDefined();
    });

    it("should create test loggers with custom directory", () => {
      expect(testMcpLogger).toBeDefined();
      expect(testWebLogger).toBeDefined();
      expect(testMcpLogger.info).toBeDefined();
      expect(testWebLogger.info).toBeDefined();
    });
  });

  describe("Log file paths", () => {
    it("should use correct directory", () => {
      const logsDir = getLogsDir();
      expect(logsDir).toContain(".config/claude-mermaid/logs");
    });

    it("should use custom directory for test loggers", () => {
      expect(testLogsDir).toContain("claude-mermaid-test-logs-");
    });
  });

  describe("Logger behavior", () => {
    it("should support all log methods", () => {
      expect(typeof testMcpLogger.debug).toBe("function");
      expect(typeof testMcpLogger.info).toBe("function");
      expect(typeof testMcpLogger.warn).toBe("function");
      expect(typeof testMcpLogger.error).toBe("function");

      expect(typeof testWebLogger.debug).toBe("function");
      expect(typeof testWebLogger.info).toBe("function");
      expect(typeof testWebLogger.warn).toBe("function");
      expect(typeof testWebLogger.error).toBe("function");
    });

    it("should write logs to test directory", async () => {
      testMcpLogger.info("Test message");

      await new Promise((resolve) => setTimeout(resolve, 100));

      const content = await readFile(join(testLogsDir, "mcp.log"), "utf-8");
      expect(content).toContain("Test message");
    });

    it("should write to separate log files", async () => {
      testMcpLogger.info("MCP test message");
      testWebLogger.info("Web test message");

      await new Promise((resolve) => setTimeout(resolve, 100));

      const mcpContent = await readFile(join(testLogsDir, "mcp.log"), "utf-8");
      const webContent = await readFile(join(testLogsDir, "web.log"), "utf-8");

      expect(mcpContent).toContain("MCP test message");
      expect(webContent).toContain("Web test message");
    });
  });

  describe("Error handling", () => {
    it("should not throw on logging errors", () => {
      expect(() => testMcpLogger.info("Test")).not.toThrow();
      expect(() => testWebLogger.error("Test")).not.toThrow();
    });
  });
});
