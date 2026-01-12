#!/usr/bin/env npx tsx
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local like Next.js does (must happen before importing terminal-server)
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

// Dynamic import to ensure env is loaded first
(async () => {
  const { createTerminalServer, getTerminalPort } =
    await import('../src/server/services/terminal-server');

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
})();
