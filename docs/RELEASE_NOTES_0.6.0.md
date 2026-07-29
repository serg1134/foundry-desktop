# Foundry 0.6.0

Foundry 0.6.0 focuses on dependable autonomous building and release confidence.

## What is new

- Added a shared behavior self-repair loop for regular builds and reliability benchmarks.
- Added repair progress and attempt tracking, including safeguards that stop repeated no-progress repairs.
- Added automatic behavior recovery when a visual repair introduces a functional regression.
- Added benchmark repair telemetry and clear self-repair results in the Benchmarks view.
- Added privacy-safe, local-only crash diagnostics with secret, email, and Windows user-path redaction.
- Added an Activity view for inspecting and copying local diagnostic reports. Reports are never uploaded automatically.
- Added an isolated Release check that verifies the app, creates and validates an installer, installs it in a temporary location, launches it, uninstalls it, and cleans up.

## Verification

- Automated unit and integration tests pass.
- TypeScript type checking passes.
- The production Electron renderer, preload, and main-process bundles build successfully.
- The Windows installer checksum and application version are verified before publishing.

## Signing status

This build can be distributed unsigned while the Windows code-signing setup is completed. Windows may display a SmartScreen warning for unsigned installers.
