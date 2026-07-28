# Foundry Desktop 0.5.0

Foundry 0.5.0 strengthens the full prompt-to-installer workflow.

## Highlights

- Five polished starting points: Custom app, Notes, Task manager, Expense tracker, and Dashboard.
- Up to four image references can be attached to an AI build request.
- Image references can be attached from the starting page before a project exists.
- Selected-element requests include precise, bounded DOM context for focused edits.
- Automated verification can confirm hover behavior and local data after an app reload.
- Runtime, AI rollback, and installer failures persist in the project Activity log.
- Generated installers honor configured window dimensions and behavior.
- Generated apps include a security-isolated bridge for user-approved text-file open and save dialogs.
- Every generated installer includes a SHA-256 checksum file.
- The bounded coding loop now has enough room for larger multi-file desktop builds while retaining write and byte limits.
- Reliability Lab can recheck or regenerate all ten cases in one resumable sequence and classifies failures by generation, compile, runtime, workflow, persistence, or visual stage.

## Reliability result

All ten persisted benchmark applications passed a fresh local recheck on July 27, 2026, covering 72 functional, compile, render, and runtime checks in total.

## Verification

- TypeScript type checking
- Automated unit and integration tests
- Production Electron/Vite build
