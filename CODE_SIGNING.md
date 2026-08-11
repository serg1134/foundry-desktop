# Release trust and code-signing policy

Foundry release binaries are produced from the public [Foundry Desktop source repository](https://github.com/serg1134/foundry-desktop) by its tag-triggered GitHub Actions workflow.

Foundry's release workflow supports Authenticode signing through Microsoft Azure Artifact Signing. Identity validation is complete, the `foundry-public-trust` certificate profile is active, and GitHub uses repository-scoped OIDC with no long-lived signing secret. Existing unsigned beta releases remain clearly labeled; future tagged releases are signed only when every verification gate passes.

## Team roles

- Committer and reviewer: [Sean Savalos (`serg1134`)](https://github.com/serg1134)
- Release approver: [Sean Savalos (`serg1134`)](https://github.com/serg1134)

Every contributor with repository or release access must enable multi-factor authentication. Changes from anyone other than the committer must be reviewed before they are merged. Every public release requires a deliberate version tag.

## Build and signing controls

- Only tagged commits from this public repository are eligible for public release.
- The release workflow installs dependencies from the committed lockfile, runs the automated test suite and production build, and generates the Windows installer and updater metadata from the same tagged revision.
- Artifact rules enforce the Foundry product name and a version matching the source tag and package metadata.
- GitHub authenticates to Azure with a repository-scoped OpenID Connect federated credential. No signing private key or long-lived Azure client secret is stored in GitHub.
- The Artifact Signing principal receives only the `Artifact Signing Certificate Profile Signer` role on the selected certificate profile.
- The unpacked `Foundry.exe` and native DLLs are signed before electron-builder packages them, then the final installer is signed separately.
- Signed release gates require valid Authenticode chains, RFC 3161 timestamps, and an exact expected certificate subject on both `Foundry.exe` and the installer before publication.
- Because signing changes the installer bytes, the workflow regenerates the blockmap, updater SHA-512 digest, and SHA-256 checksum after signing and verifies all three before publication.
- Every release publishes its checksum, updater metadata, and dependency audit with the installer.
- If the signing service, repository, or release pipeline may be compromised, releases stop while access is revoked, the incident is investigated, and affected versions are identified publicly.

## User privacy and system behavior

Foundry's [Privacy Notice](PRIVACY.md) describes its local data, diagnostics, and user-initiated AI-provider requests. Foundry does not transfer information to another networked system unless the user requests or configures the operation. It does not include advertising, behavioral analytics, or automatic telemetry.

The installer identifies the application and publisher, creates shortcuts only through disclosed installer options, and provides standard Windows uninstallation. Foundry does not silently change unrelated system configuration.

## Downloads and signing identity

Official installers are available only from [GitHub Releases](https://github.com/serg1134/foundry-desktop/releases). Every release publishes a matching `.sha256` file, updater metadata, and dependency audit. Unsigned beta releases say so prominently. Signed releases identify Azure Artifact Signing in the release notes and must pass the signer and timestamp gate before publication.

## GitHub configuration

The tagged release workflow uses these protected repository secrets:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

The secrets and variables are scoped to the protected `release-signing` GitHub environment, which permits deployment only from version tags matching `v*.*.*`. It uses these environment variables:

- `AZURE_ARTIFACT_SIGNING_ENABLED` (`true` only after setup is complete)
- `AZURE_ARTIFACT_SIGNING_ENDPOINT` (for Foundry, `https://eus.codesigning.azure.net/`)
- `AZURE_ARTIFACT_SIGNING_ACCOUNT` (for Foundry, `foundry-app-builder`)
- `AZURE_ARTIFACT_SIGNING_PROFILE` (for Foundry, `foundry-public-trust`)
- `AZURE_EXPECTED_PUBLISHER` (the complete Authenticode subject, beginning with `CN=`)

The Entra application must trust only the intended GitHub repository and release-tag subject through OIDC. Enable signing only after the public-trust certificate profile exists and the application principal has the `Artifact Signing Certificate Profile Signer` role at the narrowest available scope.
