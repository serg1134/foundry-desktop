# Foundry Desktop 0.5.2

Foundry 0.5.2 fixes the Foundry Cloud onboarding path discovered during packaged-app checkout verification.

## Highlights

- Allows users to select Foundry Cloud before they have signed in.
- Displays the sign-in and account-creation form immediately when Foundry Cloud is selected.
- Preserves the existing requirement to authenticate before running hosted builds or buying credits.
- Adds regression coverage for switching between Foundry Cloud and bring-your-own-key modes.

## Validation

- Full automated test suite passes.
- TypeScript validation passes.
- Electron main, preload, and renderer production bundles pass.
- Packaged-app verification covers the installed version, cloud sign-in path, and sandbox checkout flow.

This release remains unsigned while the project completes its code-signing setup.
