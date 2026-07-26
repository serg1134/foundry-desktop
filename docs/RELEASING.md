# Releasing Foundry

Foundry uses an HTTPS generic update feed. Each release folder must expose `latest.yml`, the matching installer, and its block map at the URL configured in the installed app.

## Build an unsigned test release

```powershell
$env:FOUNDRY_UPDATE_URL='https://downloads.example.com/foundry/windows'
npm.cmd run release:win
```

Upload the generated `latest.yml`, `Foundry-Setup-<version>.exe`, and `.blockmap` together. Installers only check the update URL supplied when that installer was built.

## Build a signed production release

Set the standard electron-builder certificate variables only in the secure release environment:

```powershell
$env:FOUNDRY_UPDATE_URL='https://downloads.example.com/foundry/windows'
$env:CSC_LINK='C:\secure\foundry-signing-certificate.pfx'
$env:CSC_KEY_PASSWORD='<certificate password>'
npm.cmd run release:win
```

Never commit the certificate or password. After building, verify the signature in Windows file Properties, install on a clean machine, check for updates from the prior version, download, restart, and confirm the new version in About.

## Version checklist

1. Update `version` in `package.json` and `package-lock.json`.
2. Run `npm test` and `npm run build`.
3. Build using `npm run release:win`.
4. Publish all update artifacts atomically so `latest.yml` never points to a missing installer.
5. Test install, update, rollback expectations, and SmartScreen reputation.
