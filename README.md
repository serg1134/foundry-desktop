# Foundry Desktop

Foundry is a conversational builder that turns a description into a working desktop application. It can create projects from templates, edit them with a selected AI provider, compile and preview them locally, launch them as standalone desktop windows, and package native Windows, macOS, or Linux installers on the matching host operating system.

Generated apps can use Foundry's narrow desktop bridge for user-approved text-file open and save dialogs. The bridge never exposes arbitrary filesystem paths or Node.js to generated renderer code.

Foundry is open-source software under the [MIT License](LICENSE). See the [Privacy Notice](PRIVACY.md) for its local data and AI-provider practices. Windows releases follow the documented [Code signing policy](CODE_SIGNING.md), and security issues should be reported using the process in [SECURITY.md](SECURITY.md).

Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).

## Product workflow

1. Create a Custom app, Notes, Task manager, Expense tracker, or Dashboard project.
2. Add an OpenAI API key in AI settings. The key is encrypted with the operating-system credential service.
3. Describe an app or a focused change in the builder prompt.
4. Follow the live Plan, Explore, Build, Verify, and Repair timeline; stop a run whenever needed.
5. Foundry checks compile/runtime behavior, reviews a rendered screenshot, and performs one bounded visual repair when needed.
6. Attach up to four visual references or select an element in Preview to start a precisely targeted change request.
7. Accept the result into a checkpoint or undo the complete AI build.
8. Review source files, activity, and recoverable Git checkpoints.
9. Configure the app name, version, publisher, icon, window, and installer behavior.
10. Build a native installer for the current desktop operating system.

## Safety model

- Renderer sandboxing, context isolation, and a narrow typed IPC bridge
- Project-root path containment and symlink-escape prevention
- Text-only file allowlist, 1 MB file limit, and bounded AI writes
- No agent shell access
- Compile validation before an AI run can report success
- Bounded functional and screenshot-aware visual repair passes
- Isolated post-build launch verification with compile, render, input, button, and runtime evidence
- Safe automatic interaction smoke tests that avoid sensitive fields and destructive controls
- Agent-authored semantic workflows with bounded fill, click, visible-text, hover, and reload-persistence assertions
- Local reliability dashboard with ten isolated, opt-in desktop generation benchmarks
- Transactional rollback to a pre-request checkpoint on terminal failure
- Sandboxed previews and desktop runtimes with denied permission requests and navigation
- Persistent local diagnostics, an audit log, and Git-backed checkpoint restoration

## Privacy at a glance

- No advertising, analytics, telemetry, or behavioral tracking
- Projects, checkpoints, configuration, and activity history are stored locally
- Provider keys and generated-app AI tokens are encrypted with the operating system's credential protection
- BYOK requests go directly to the selected provider; Foundry Cloud requests pass through the hosted gateway for authentication, credit accounting, and provider forwarding
- Stripe processes optional Foundry Cloud credit purchases; Foundry does not receive full card details
- Generated applications are never automatically uploaded or published

Read the complete [Foundry Desktop Privacy Notice](PRIVACY.md).

Unsigned installers work normally but may trigger Windows SmartScreen. `electron-builder` honors standard `CSC_LINK` and `CSC_KEY_PASSWORD` environment credentials for signed release builds.

## Development

Foundry uses Electron, React, TypeScript, electron-vite, esbuild, isomorphic-git, and electron-builder.

```powershell
$env:Path = (Resolve-Path '.\.tools\node-v24.18.0-win-x64').Path + ';' + $env:Path
npm.cmd install
npm.cmd test
npm.cmd run dev
```

Create Foundry's Windows installer with:

```powershell
npm.cmd run dist:win
```

Production artifacts are written to `release/`. Generated project installers and their SHA-256 checksum files are written under each project's `.foundry/releases/` directory.
# Foundry hosted AI gateway

Foundry supports a server-owned AI gateway foundation so customers can build without supplying a provider API key. The desktop sends model requests to the gateway, while project tools and files continue to execute locally. Provider credentials remain server-side.

Start the local gateway for development:

```powershell
$env:OPENAI_API_KEY='your-server-side-key'
npm run gateway:dev
```

The local service binds to `127.0.0.1:8787` and stores accounts, hashed sessions, credit reservations, settlements, verified purchases, and an immutable usage ledger in `data/foundry-gateway.sqlite`. Configuration is environment-only: `FOUNDRY_GATEWAY_PORT`, `FOUNDRY_GATEWAY_DATABASE`, `FOUNDRY_SIGNUP_CREDITS`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, and `XAI_API_KEY`.

Stripe-hosted credit checkout additionally requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_BUILDER`, `STRIPE_PRICE_STUDIO`, `FOUNDRY_BILLING_SUCCESS_URL`, and `FOUNDRY_BILLING_CANCEL_URL`. Set `FOUNDRY_STRIPE_MODE` to `test` or `live`; the gateway refuses checkout when the Stripe key belongs to the other mode. Configure the webhook endpoint as `/v1/billing/webhook` and subscribe to `checkout.session.completed`. The raw request body is signature-checked with a five-minute tolerance, and checkout event/session IDs are stored uniquely so webhook retries cannot grant credits twice.

Before a public launch, deploy the gateway behind TLS and a managed database, replace the single-process server with horizontally safe rate limiting, connect verified checkout webhooks to credit grants, add email verification/password recovery, and configure production provider credentials. Never bundle those credentials in the desktop installer.

## Gateway deployment

The production image is defined in `Dockerfile.gateway`. Copy `deploy/gateway.env.example` to `deploy/gateway.env`, replace every blank or placeholder secret, and run `docker compose -f deploy/compose.gateway.yml up -d --build` on a TLS-terminated host. The container runs without root privileges, drops Linux capabilities, uses a read-only filesystem, and persists only `/var/lib/foundry`.

The gateway exposes `/health/live` for process health and `/health/ready` for traffic readiness. In production, readiness returns `503` until at least one AI provider and the complete Stripe configuration are present. Authentication, webhook, and general API traffic have separate persistent rate limits. Set `FOUNDRY_TRUST_PROXY=1` only when the gateway is behind a trusted reverse proxy that replaces `X-Forwarded-For`; never expose the container port directly with that option enabled. Request logs use a salted client hash rather than recording raw IP addresses.

The included SQLite/WAL deployment is suitable for a single gateway instance and pre-production testing. A multi-instance public rollout still requires the managed PostgreSQL storage adapter and distributed migration/backup procedure; do not scale this container horizontally against a shared SQLite file.
