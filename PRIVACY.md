# Foundry Desktop Privacy Notice

Last updated: July 29, 2026

Foundry Desktop is an open-source, local-first desktop application builder. This notice explains what Foundry stores, which services receive information, and the choices available to you.

## Information stored on your device

Foundry stores project source files, build output, checkpoints, activity history, project locations, application settings, and crash reports locally. Provider API keys and generated-app managed AI tokens are encrypted with Electron `safeStorage` and your operating system's credential protection.

Foundry does not include advertising, behavioral tracking, or third-party analytics.

## AI building modes

Foundry supports two ways to access AI models:

- **Your own provider key (BYOK):** prompts, agent instructions, attachments, and relevant project-file content are sent directly to the provider you select, which may be OpenAI, Anthropic, Google, or xAI. The provider's terms and privacy practices apply.
- **Foundry Cloud:** account authentication data, prompts, attachments, relevant project-file content, model request data, and usage metadata are sent to the Foundry gateway. The gateway authenticates the request, tracks credits and limits, and forwards model requests to the selected AI provider.

Do not submit secrets, personal information, or confidential source code unless you are authorized to send it to the selected service. Removing a locally saved key deletes Foundry's encrypted copy, but does not delete information already processed by a provider.

## Accounts and billing

When Foundry Cloud is enabled, the gateway stores account email, password hashes, session records, credit balances, usage ledger entries, purchase records, rate-limit state, and generated-app credential metadata. Session and app tokens are stored as one-way hashes by the gateway.

Stripe processes checkout and payment details. Foundry receives identifiers and purchase status needed to grant credits, but does not receive full payment-card numbers. Stripe's privacy terms apply.

## Updates and downloads

Installed builds may connect to GitHub Releases to check for and download updates. GitHub may receive standard connection information such as IP address and request metadata.

## Generated applications

Generated applications are stored locally unless you choose to publish or distribute them. An app may access native capabilities or HTTPS services only when its project permissions allow them. Apps configured for managed AI send their model requests through the Foundry gateway. You are responsible for the behavior, security, and privacy disclosures of applications you distribute.

## Retention and deletion

Local data remains until you remove it in Foundry, delete the project, or uninstall Foundry and remove its application-data directory. Cloud account, billing, and usage records remain as needed to operate the service, prevent abuse, resolve disputes, and meet legal or accounting obligations. Contact the project maintainers to request account deletion; some transaction records may need to be retained where required by law.

## Security and questions

Report security issues using [SECURITY.md](SECURITY.md). For privacy questions, use the repository contact process without posting sensitive information publicly.

This notice may change as Foundry adds services or integrations. Material changes will be documented in the repository and release notes.
