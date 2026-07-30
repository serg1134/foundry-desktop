# Code signing policy

Foundry release binaries are produced from the public [Foundry Desktop source repository](https://github.com/serg1134/foundry-desktop) by its tag-triggered GitHub Actions workflow.

Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).

## Team roles

- Committer and reviewer: [Sean Savalos (`serg1134`)](https://github.com/serg1134)
- Signing approver: [Sean Savalos (`serg1134`)](https://github.com/serg1134)

Every contributor with repository or SignPath access must enable multi-factor authentication. Changes from anyone other than the committer must be reviewed before they are merged. Every production signing request requires a manual decision by the signing approver.

## Build and signing controls

- Only tagged commits from this public repository are eligible for production signing.
- The release workflow installs dependencies from the committed lockfile, runs the automated test suite and production build, and generates the Windows installer and updater metadata from the same tagged revision.
- SignPath may sign only Foundry artifacts built from source and build scripts maintained in this repository. Foundry does not use its signing entitlement to sign unrelated, upstream, or user-generated applications.
- Artifact rules enforce the Foundry product name and a version matching the source tag and package metadata.
- Signing credentials and private keys are never stored in the repository. SignPath protects the certificate and authorizes requests from the release workflow.
- The release gate verifies the Authenticode signer, trusted timestamp, SHA-256 checksum, and updater SHA-512 digest before publication.
- Every release publishes its checksum, updater metadata, and dependency audit with the installer.
- If the signing service, repository, or release pipeline may be compromised, releases stop while access is revoked, the incident is investigated, and affected versions are identified publicly.

## User privacy and system behavior

Foundry's [Privacy Notice](PRIVACY.md) describes its local data, diagnostics, and user-initiated AI-provider requests. Foundry does not transfer information to another networked system unless the user requests or configures the operation. It does not include advertising, behavioral analytics, or automatic telemetry.

The installer identifies the application and publisher, creates shortcuts only through disclosed installer options, and provides standard Windows uninstallation. Foundry does not silently change unrelated system configuration.

## Downloads and signing identity

Official installers are available only from [GitHub Releases](https://github.com/serg1134/foundry-desktop/releases). Production release notes identify SignPath.io and SignPath Foundation and link back to this policy. Unsigned development builds, when provided, are explicitly labeled and are not production releases.

The production certificate is issued to **SignPath Foundation**. SignPath Foundation may suspend signing or revoke signatures if this project violates its [Code of Conduct](https://signpath.org/terms).
