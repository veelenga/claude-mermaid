// Disable logging during tests to avoid writing to real config directory
// This must run before any modules are imported
process.env.CLAUDE_MERMAID_LOG_LEVEL = "OFF";
