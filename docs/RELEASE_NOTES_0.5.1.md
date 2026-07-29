# Foundry Desktop 0.5.1

Foundry 0.5.1 completes the hosted-credit checkout experience.

## Highlights

- Replaces the post-checkout authentication error with polished success and cancellation pages.
- Refreshes the Foundry Cloud credit balance automatically after Stripe confirms payment.
- Shows the exact number of credits added without requiring a manual refresh.
- Enforces an explicit Stripe test/live mode guard to prevent mixed billing environments.
- Adds regression coverage for checkout return pages, webhook delivery, duplicate events, and the complete managed-build journey.

## Validation

- Full automated test suite passes.
- TypeScript validation passes.
- Electron main, preload, and renderer production bundles pass.
- Windows installer and update metadata are verified before publication.

This release remains unsigned while the project completes its code-signing setup.
