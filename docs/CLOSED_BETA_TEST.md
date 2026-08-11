# Foundry Closed Beta Test Mission

Thank you for testing Foundry. This mission takes about 30–45 minutes and tests the complete path from download to a working desktop app.

## Before you begin

- Use a Windows 10 or Windows 11 computer you can install applications on.
- Do not use private source code, passwords, API keys, financial records, or irreplaceable files in a test project.
- Download the newest release only from [Foundry's official GitHub Releases](https://github.com/serg1134/foundry-desktop/releases/latest).
- Follow the checksum and signature steps in the [Public Beta Guide](PUBLIC_BETA.md).

## Your mission

1. **Install Foundry.** Record whether Windows or antivirus software warned, blocked, or delayed the installer.
2. **Create a project.** Pick a template or describe a small app you genuinely want. Good examples are a clipboard organizer, meeting-notes tool, habit tracker, file renamer, or personal dashboard.
3. **Build and interact.** Complete the app's primary workflow with real test data. Close and reopen the preview and confirm the data still exists when persistence was requested.
4. **Make one change.** Ask Foundry to change behavior or styling. Confirm the accepted result appears in Preview and the prior version remains recoverable.
5. **Package the app.** Run **Test & Ship**, create the Windows installer, install the generated app, launch it from the Start Menu, and repeat its primary workflow outside Foundry.
6. **Restart and uninstall.** Close and reopen the generated app to check persistence, then uninstall it from Windows Settings. Finally uninstall Foundry only if you do not plan to keep testing.

## What counts as success

- Foundry installs and launches without requiring antivirus protection to be disabled.
- A non-developer can understand what Foundry is doing and recover from a failure.
- Preview controls respond to clicks and text entry.
- The generated app installs, launches, performs its advertised workflow, and preserves requested local data.
- Both Foundry and the generated app can be uninstalled normally.

## Send the result

Submit the [Foundry beta feedback form](https://github.com/serg1134/foundry-desktop/issues/new?template=beta-feedback.yml), including successful results. If something fails, include the exact non-sensitive error and the last step that worked.

Never attach passwords, API keys, payment details, personal file paths, private project code, or confidential data. Report security vulnerabilities through [private vulnerability reporting](https://github.com/serg1134/foundry-desktop/security/advisories/new), not a public issue.
