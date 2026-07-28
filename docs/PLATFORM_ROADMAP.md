# Foundry platform roadmap

Foundry's goal is to make a complete desktop application from a plain-language request, verify the real workflow, and publish a trustworthy installer without requiring the user to become a software engineer.

## Product loop

1. Describe — prompt, template, screenshot, pasted image, code, or data reference.
2. Plan — show the build plan, assumptions, affected capabilities, and estimated API use.
3. Build — edit a local project through bounded tools and live checkpoints.
4. Preview — interact with the app, select an element, and request a precise change.
5. Verify — compile, exercise semantic workflows, reload persistence, and review screenshots.
6. Repair — diagnose failures, apply focused repairs, and rerun only relevant checks.
7. Configure — identity, icon, permissions, windows, native capabilities, and release metadata.
8. Publish — signed installer, update feed, release notes, checksums, and rollback.

## Milestones

### M1 — Reliable local builder

- Mixed prompt context: images, pasted screenshots, text, code, and data files.
- Visible plan and progress timeline with cancellation.
- Checkpoints, diffs, undo, and explicit build acceptance.
- Interactive preview and precise element targeting.
- Compile, workflow, persistence, runtime, and visual verification.
- Failure classification, bounded repair loops, and deterministic benchmark suite.

Exit criterion: at least 9 of 10 benchmark projects pass three consecutive clean runs.

### M2 — Desktop capability system

- Permissioned capability manifest per project.
- File open/save, folders, notifications, clipboard, menus, tray, shortcuts, and deep links.
- Local SQLite data and migrations.
- HTTP/API client with secret references stored outside generated source.
- Capability-aware templates, typed APIs, verification fixtures, and permission review.

Exit criterion: every capability ships with a typed bridge, security policy, example, and automated test.

### M3 — Full product construction

- Multi-page/window app planning and navigation.
- Reusable components, design tokens, themes, assets, and responsive states.
- Data schema designer, seeded data, import/export, charts, and tables.
- Authentication and common service integrations through an adapter catalog.
- Plugin SDK for templates, capabilities, verifiers, and publishing targets.

Exit criterion: Foundry can build and verify ten production-shaped reference apps without manual code edits.

### M4 — Cloud platform

- Accounts, organizations, projects, roles, and encrypted cloud sync.
- Branches, shared previews, comments, presence, and conflict-safe collaboration.
- Managed secrets, build workers, artifact storage, usage metering, quotas, and billing.
- Template and plugin marketplace with review, signing, and version compatibility.

Exit criterion: two users can safely co-build, review, and publish the same project from separate machines.

### M5 — Publishing and operations

- Windows code signing, timestamping, reputation guidance, and automatic updates.
- macOS notarization and Linux packages after the Windows workflow is reliable.
- Crash reporting, privacy-respecting analytics, diagnostics export, and support tooling.
- Release channels, staged rollout, rollback, dependency/security scanning, and incident runbooks.

Exit criterion: signed releases can be promoted, monitored, updated, and rolled back without rebuilding.

## Non-negotiable architecture

- Generated code belongs to the user and remains runnable outside Foundry.
- Local-first editing and previews continue to work without a Foundry cloud account.
- The renderer never receives raw provider keys or unrestricted Node.js access.
- Native capabilities are explicit, least-privileged, typed, and visible before packaging.
- AI output is untrusted until compilation and behavioral verification pass.
- External side effects require clear user confirmation and auditable boundaries.

## Current release boundary

Version 0.5 provides the local builder core: projects, AI edits, multimodal references, checkpoints, preview targeting, verification and repair, benchmarks, app configuration, and Windows installer generation. The next release focuses on reliability gates and the permissioned desktop capability system. Cloud collaboration and billing come only after the local product loop is consistently dependable.
