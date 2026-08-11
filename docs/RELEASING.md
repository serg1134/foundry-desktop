# Releasing Foundry

Foundry uses the public GitHub Releases feed at `https://github.com/serg1134/foundry-desktop/releases/latest/download`. Each release exposes `latest.yml`, the matching installer, and its block map.

## Automated GitHub release

After updating the version and pushing the source, create and push a matching tag such as `v0.5.0`. The Windows release workflow rejects a tag that does not exactly match `package.json`, runs tests, builds and validates the installer and update metadata, and publishes the GitHub Release automatically.

## Build an unsigned test release

```powershell
$env:FOUNDRY_UPDATE_URL='https://downloads.example.com/foundry/windows'
npm.cmd run release:win
```

Upload the generated `latest.yml`, `Foundry-Setup-<version>.exe`, `.blockmap`, and `.sha256` together. Installers only check the update URL supplied when that installer was built. The release script uses the Windows temporary directory by default to avoid sync-client file locks.

## Build a signed production release

Production signing runs only in the tag-triggered GitHub workflow. GitHub exchanges a repository-scoped OIDC token for short-lived Azure access, signs the unpacked application executables and DLLs, uses electron-builder's Azure integration to sign the generated NSIS uninstaller, and then signs the final installer through Azure Artifact Signing. It performs a clean installation, regenerates the changed blockmap and hashes, and verifies the Authenticode publisher and timestamp on `Foundry.exe`, `Uninstall Foundry.exe`, and the installer. No `.pfx`, private key, Azure client secret, `CSC_LINK`, or `CSC_KEY_PASSWORD` belongs in the repository.

After the workflow succeeds, install on a clean machine, check the signature in Windows file Properties, test updating from the prior version, restart, and confirm the new version in About.

## Current signing status

Azure identity validation is complete, the `foundry-public-trust` public-trust certificate profile is active, GitHub OIDC is restricted to the `release-signing` environment, and the application principal has the scoped signer role. The protected environment sets `AZURE_ARTIFACT_SIGNING_ENABLED=true`; the workflow signs and timestamps the application, uninstaller, and installer, regenerates updater metadata and checksums, and refuses publication unless every signature subject matches `AZURE_EXPECTED_PUBLISHER`.

Existing unsigned beta releases remain unsigned and clearly labeled. Never bypass the signature verification gate or publish a tagged production release through an environment other than `release-signing`.

## Version checklist

1. Update `version` in `package.json` and `package-lock.json`.
2. Run `npm test` and `npm run build`.
3. Build using `npm run release:win`; the script validates the checksum and required update artifacts.
4. Verify the `.sha256` file against the installer. For a signed release, also run `scripts/verify-release.ps1 -ReleaseDirectory <path> -RequireSigned -ExpectedPublisher '<certificate subject>'`.
5. Publish all update artifacts atomically so `latest.yml` never points to a missing installer.
6. Test install, update, rollback expectations, and SmartScreen reputation.
