# Foundry Desktop

Foundry is a Windows-first conversational desktop app builder. It lets users describe an application, then generates, previews, and packages it as a standalone Windows desktop app.

## Stack

- **Electron** + **electron-vite** — desktop shell and dev toolchain
- **React** + **TypeScript** — UI
- **esbuild** — bundling
- **isomorphic-git** — checkpoint/rollback system
- **electron-builder** — Windows NSIS installer packaging
- **OpenAI API** — coding agent (key stored in OS credential service)

## Running locally (Windows only)

This project requires Windows and Node.js. It cannot be run or previewed on Replit.

```powershell
$env:Path = (Resolve-Path '.\.tools\node-v24.18.0-win-x64').Path + ';' + $env:Path
npm.cmd install
npm.cmd test
npm.cmd run dev
```

Build a Windows installer:

```powershell
npm.cmd run dist:win
```

Release artifacts go to `release/`. Project-specific installers are written under each project's `.foundry/releases/` directory.

## Key source locations

- `src/` — renderer (React/TypeScript UI)
- `src/main/` — Electron main process
- `src/preload/` — context bridge / IPC preload scripts
- `electron.vite.config.ts` — build config
- `build/` — app icons and build assets
- `scripts/` — release helper scripts

## User preferences

_None recorded yet._
