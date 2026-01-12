#!/usr/bin/env npx tsx
import {
  createTerminalServer,
  getTerminalPort,
} from '../src/server/services/terminal-server';

const port = getTerminalPort();
createTerminalServer(port);

process.on('SIGINT', () => {
  console.log('\nShutting down terminal server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down terminal server...');
  process.exit(0);
});
