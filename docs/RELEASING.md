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

## Build a signed production release locally

Set the standard electron-builder certificate variables only in the secure release environment:

```powershell
$env:FOUNDRY_UPDATE_URL='https://downloads.example.com/foundry/windows'
$env:CSC_LINK='C:\secure\foundry-signing-certificate.pfx'
$env:CSC_KEY_PASSWORD='<certificate password>'
npm.cmd run release:win
```

Never commit the certificate or password. After building, verify the signature in Windows file Properties, install on a clean machine, check for updates from the prior version, download, restart, and confirm the new version in About.

## Sign production releases with SignPath

Tagged GitHub releases use SignPath's GitHub Action. The workflow uploads the unsigned installer as a GitHub Actions artifact, submits it to SignPath, replaces the unsigned installer with the returned file, regenerates the blockmap and update metadata, and requires a valid Authenticode signature before publishing.

Configure these GitHub Actions secrets:

- `SIGNPATH_API_TOKEN`
- `SIGNPATH_ORGANIZATION_ID`

Configure these GitHub Actions variables:

- `SIGNPATH_PROJECT_SLUG`
- `SIGNPATH_SIGNING_POLICY_SLUG`
- `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG`

The SignPath artifact configuration must accept the ZIP produced by `actions/upload-artifact`, contain `Foundry-Setup-${version}.exe`, and apply Authenticode signing to that PE file. Install the SignPath GitHub App for this repository and use a SignPath user/API token limited to submitting requests under the configured policy.

## Version checklist

1. Update `version` in `package.json` and `package-lock.json`.
2. Run `npm test` and `npm run build`.
3. Build using `npm run release:win`; the script validates the checksum and required update artifacts.
4. For production, rerun `scripts/verify-release.ps1 -ReleaseDirectory <path> -RequireSigned` and require a valid Authenticode signature.
5. Publish all update artifacts atomically so `latest.yml` never points to a missing installer.
6. Test install, update, rollback expectations, and SmartScreen reputation.
