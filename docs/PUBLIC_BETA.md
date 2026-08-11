# Foundry Public Beta Guide

Foundry is beta software. Keep backups of important projects and test generated applications before relying on them for important work.

## Install safely on Windows

1. Download `Foundry-Setup-<version>.exe` and its matching `.sha256` file from the official [GitHub Releases](https://github.com/serg1134/foundry-desktop/releases) page.
2. In PowerShell, run:

   ```powershell
   Get-FileHash .\Foundry-Setup-<version>.exe -Algorithm SHA256
   ```

3. Confirm the displayed hash exactly matches the value in the downloaded `.sha256` file.
4. Open **Properties → Digital Signatures** and confirm the signer is **Sean Avalos**. Foundry v0.7.13 and later Windows releases are signed and timestamped through Microsoft Azure Artifact Signing. Earlier beta releases may still be unsigned.
5. Do not continue if the checksum does not match, the expected signature is missing from v0.7.13 or later, or the file came from another source.
6. Install Foundry, create a disposable first project, and run **Test & Ship** before using it with important data.

## What stays local

Projects, checkpoints, configuration, activity history, and privacy-safe crash diagnostics remain on the computer. AI requests leave the computer only when the user initiates a build using Foundry Cloud or a configured provider. Generated apps are not uploaded automatically.

## Report a useful bug

Include the Foundry version, Windows version, exact steps, expected result, actual result, and whether the problem repeats. Copy the privacy-safe report from **Activity** when available. Never publish API keys, credentials, payment information, private source code, or personal file paths.

Security vulnerabilities belong in GitHub private vulnerability reporting, not a public issue.

For a complete first-session walkthrough, use the [Closed Beta Test Mission](CLOSED_BETA_TEST.md). Submit the structured [Foundry beta feedback form](https://github.com/serg1134/foundry-desktop/issues/new?template=beta-feedback.yml) after testing—even when everything works.

## Uninstall

Use Windows **Settings → Apps → Installed apps → Foundry → Uninstall**. Project folders are user data and are not removed automatically.
