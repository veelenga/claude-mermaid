#!/usr/bin/env node

import { ensureLiveServer } from "./build/live-server.js";

console.log("Starting live server...");
const port = await ensureLiveServer();
console.log(`Server running at http://localhost:${port}`);
console.log(`Test with: http://localhost:${port}/file/{preview_id}`);

// Keep the process running
process.stdin.resume();
