# Contributing to Foundry

Foundry welcomes reproducible bug reports, documentation improvements, focused fixes, and new tests.

## Before opening a change

1. Search existing issues and keep each contribution focused on one problem.
2. Do not include API keys, tokens, customer data, private projects, generated installers, or local diagnostic files.
3. For security issues, use GitHub private vulnerability reporting instead of a public issue.

## Verify a code change

```powershell
npm.cmd install
npm.cmd test
npm.cmd run build
```

Changes to generated-app behavior should include an automated workflow or contract test. UI changes should be keyboard accessible, usable at narrow window sizes, and respect reduced-motion and high-contrast preferences.

By contributing, you agree that your contribution is licensed under the repository's MIT License.
