# Foundry Desktop

Foundry is a Windows-first conversational builder that turns a description into a working desktop application. It can create projects from templates, edit them with an OpenAI coding agent, compile and preview them locally, launch them as standalone desktop windows, and package them as NSIS Windows installers.

Foundry is open-source software under the [MIT License](LICENSE). Windows releases follow the documented [Code signing policy](CODE_SIGNING.md), and security issues should be reported using the process in [SECURITY.md](SECURITY.md).

## Product workflow

1. Create a Blank, Notes, or Dashboard project.
2. Add an OpenAI API key in AI settings. The key is encrypted with the operating-system credential service.
3. Describe an app or a focused change in the builder prompt.
4. Test it in the sandboxed live preview and standalone Run app window.
5. Review source files, activity, and recoverable Git checkpoints.
6. Configure the app name, version, publisher, icon, window, and installer behavior.
7. Build a Windows installer.

## Safety model

- Renderer sandboxing, context isolation, and a narrow typed IPC bridge
- Project-root path containment and symlink-escape prevention
- Text-only file allowlist, 1 MB file limit, and bounded AI writes
- No agent shell access
- Compile validation before an AI run can report success
- One bounded automatic repair pass
- Transactional rollback to a pre-request checkpoint on terminal failure
- Sandboxed previews and desktop runtimes with denied permission requests and navigation
- Local audit log and Git-backed checkpoint restoration

Unsigned installers work normally but may trigger Windows SmartScreen. `electron-builder` honors standard `CSC_LINK` and `CSC_KEY_PASSWORD` environment credentials for signed release builds.

## Development

Foundry uses Electron, React, TypeScript, electron-vite, esbuild, isomorphic-git, and electron-builder.

```powershell
$env:Path = (Resolve-Path '.\.tools\node-v24.18.0-win-x64').Path + ';' + $env:Path
npm.cmd install
npm.cmd test
npm.cmd run dev
```

Create Foundry's Windows installer with:

```powershell
npm.cmd run dist:win
```

Production artifacts are written to `release/`. Generated project installers are written under each project's `.foundry/releases/` directory.
