# Foundry 0.7.10

Foundry 0.7.10 is the public beta readiness release.

## Highlights

- Keeps the desktop app packager available inside installed Foundry builds.
- Updates transitive dependencies to resolve the current production audit findings.
- Preserves the hardened Windows runtime behavior introduced in the 0.7.x series.
- Includes the public beta feedback, support, diagnostics, and recovery workflows.

## Qualification

- Unit and integration test suite
- Production renderer and Electron build
- Windows installer install, launch, persistence, and uninstall workflows
- Generated notes, task manager, and expense tracker desktop applications
- Public release checksum verification
- Norton-enabled runtime qualification

## Known limitation

This release is not yet code signed. Windows SmartScreen and third-party antivirus products may warn about a new, unsigned publisher. Only download Foundry from the official GitHub release linked by foundryappbuilder.com and verify the published SHA-256 checksum.
