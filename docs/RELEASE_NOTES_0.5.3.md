# Foundry Desktop 0.5.3

Foundry 0.5.3 improves the hosted-billing experience after a checkout or balance refresh succeeds.

## Highlights

- Clears stale Stripe error banners when a new checkout begins.
- Clears prior billing errors after a successful cloud balance refresh.
- Clears prior billing errors when purchased credits are detected.
- Adds regression coverage for successful cloud-billing feedback.

## Validation

- Full automated test suite passes.
- TypeScript validation passes.
- Electron main, preload, and renderer production bundles pass.
- Windows installer packaging and checksum verification pass.

This release remains unsigned while the project completes its code-signing setup.
