# Foundry Public Beta Guide

Foundry is beta software. Keep backups of important projects and test generated applications before relying on them for important work.

## Install safely on Windows

1. Download `Foundry-Setup-<version>.exe` and its matching `.sha256` file from the official [GitHub Releases](https://github.com/serg1134/foundry-desktop/releases) page.
2. In PowerShell, run:

   ```powershell
   Get-FileHash .\Foundry-Setup-<version>.exe -Algorithm SHA256
   ```

3. Confirm the displayed hash exactly matches the value in the downloaded `.sha256` file.
4. Because the beta is currently unsigned, Windows may display an unknown-publisher or SmartScreen warning. Do not continue if the checksum does not match or the file came from another source.
5. Install Foundry, create a disposable first project, and run **Test & Ship** before using it with important data.

## What stays local

Projects, checkpoints, configuration, activity history, and privacy-safe crash diagnostics remain on the computer. AI requests leave the computer only when the user initiates a build using Foundry Cloud or a configured provider. Generated apps are not uploaded automatically.

## Report a useful bug

Include the Foundry version, Windows version, exact steps, expected result, actual result, and whether the problem repeats. Copy the privacy-safe report from **Activity** when available. Never publish API keys, credentials, payment information, private source code, or personal file paths.

Security vulnerabilities belong in GitHub private vulnerability reporting, not a public issue.

## Uninstall

Use Windows **Settings → Apps → Installed apps → Foundry → Uninstall**. Project folders are user data and are not removed automatically.
