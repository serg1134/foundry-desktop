# Release trust and code-signing policy

Foundry release binaries are produced from the public [Foundry Desktop source repository](https://github.com/serg1134/foundry-desktop) by its tag-triggered GitHub Actions workflow.

Foundry is currently distributed as an **unsigned public beta**. SignPath Foundation has not approved the project for its free signing program. Foundry does not claim that current artifacts are signed or endorsed by SignPath. A commercial signing provider may be added later; this policy will be updated before any signed release is published.

## Team roles

- Committer and reviewer: [Sean Savalos (`serg1134`)](https://github.com/serg1134)
- Release approver: [Sean Savalos (`serg1134`)](https://github.com/serg1134)

Every contributor with repository or release access must enable multi-factor authentication. Changes from anyone other than the committer must be reviewed before they are merged. Every public release requires a deliberate version tag.

## Build and signing controls

- Only tagged commits from this public repository are eligible for public release.
- The release workflow installs dependencies from the committed lockfile, runs the automated test suite and production build, and generates the Windows installer and updater metadata from the same tagged revision.
- Artifact rules enforce the Foundry product name and a version matching the source tag and package metadata.
- Signing credentials and private keys must never be stored in the repository if commercial signing is introduced.
- The current release gate verifies the SHA-256 checksum, updater SHA-512 digest, dependency audit, build, and automated tests before publication.
- Every release publishes its checksum, updater metadata, and dependency audit with the installer.
- If the signing service, repository, or release pipeline may be compromised, releases stop while access is revoked, the incident is investigated, and affected versions are identified publicly.

## User privacy and system behavior

Foundry's [Privacy Notice](PRIVACY.md) describes its local data, diagnostics, and user-initiated AI-provider requests. Foundry does not transfer information to another networked system unless the user requests or configures the operation. It does not include advertising, behavioral analytics, or automatic telemetry.

The installer identifies the application and publisher, creates shortcuts only through disclosed installer options, and provides standard Windows uninstallation. Foundry does not silently change unrelated system configuration.

## Downloads and signing identity

Official installers are available only from [GitHub Releases](https://github.com/serg1134/foundry-desktop/releases). While the beta remains unsigned, every release must say so prominently and publish a matching `.sha256` file and dependency audit. Users should verify the checksum before installation and expect Windows SmartScreen to show an unknown-publisher warning.
