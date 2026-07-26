# Code signing policy

Foundry release binaries are produced from the public source repository by the tag-triggered GitHub Actions release workflow.

## Controls

- Only tagged commits on the public repository are eligible for production signing.
- The release workflow runs the automated test suite and production build before packaging.
- GitHub Actions generates the Windows installer and update metadata from the same tagged source revision.
- Signing credentials and private keys are never stored in the repository. A signing service must protect private keys in an HSM and authorize requests from the release workflow.
- Release assets include cryptographic digests. Users should download installers only from this repository's GitHub Releases page.
- Maintainers review dependency and workflow changes before tagging a release.
- If a signing credential or release pipeline is suspected of compromise, releases stop until access is revoked, the incident is investigated, and affected versions are identified publicly.

## Signing identity

Unsigned preview builds may be published during development and are labeled accordingly. Production builds will identify the active certificate publisher in their release notes after the signing service approves the project.
