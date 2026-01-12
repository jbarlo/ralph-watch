# Ralph Watch

A web UI for monitoring and controlling Ralph (autonomous coding agent) workflows.

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Configure environment variables (see `.env.example`):

```bash
cp .env.example .env.local
# Edit .env.local with your RALPH_BIN path
```

3. Run the development server:

```bash
pnpm dev
```

4. (Optional) Run the terminal server for embedded Claude terminal:

```bash
pnpm terminal
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Embedded Terminal

The UI includes an embedded Claude Code terminal. To use it:

1. Start the terminal WebSocket server:

```bash
pnpm terminal
```

2. In the UI, open the side panel and click the "Terminal" tab
3. Click "Connect" to start a Claude session

The terminal server runs on port 3001 by default (configurable via `TERMINAL_WS_PORT`).

## Remote Terminal Access

By default, the embedded terminal is **localhost-only** for security.

To enable remote access (e.g., for Tailscale):

```bash
RALPH_ENABLE_REMOTE_TERMINAL=yes-i-understand-this-is-dangerous pnpm terminal
```

**WARNING:** This exposes a full terminal with your user permissions to anyone who can reach the WebSocket port. No authentication is provided. Only enable this on trusted networks (like Tailscale) where network-level auth exists.

## Scripts

- `pnpm dev` - Start Next.js development server
- `pnpm build` - Production build
- `pnpm terminal` - Start terminal WebSocket server
- `pnpm check` - Run lint, typecheck, and tests

## Environment Variables

See `.env.example` for all available options:

- `RALPH_BIN` - Path to ralph binaries (required)
- `RALPH_DIR` - Default project directory (optional)
- `TERMINAL_WS_PORT` - Terminal WebSocket port (default: 3001)
- `RALPH_ENABLE_REMOTE_TERMINAL` - Enable remote terminal access (dangerous)
