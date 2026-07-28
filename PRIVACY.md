# Foundry Desktop Privacy Notice

Last updated: July 26, 2026

Foundry Desktop is an open-source, local-first desktop application builder. This notice explains what the application stores and when information leaves your computer.

## Information stored locally

Foundry stores the following information on your device:

- The list and locations of projects you open or create
- Project source files, build output, configuration, checkpoints, and activity history
- Application settings
- Your OpenAI API key, encrypted using Electron `safeStorage` and the operating system's credential protection

Foundry does not include advertising, analytics, telemetry, or behavioral tracking.

## Information sent to OpenAI

Foundry connects directly to the OpenAI API using the API key you provide. When you verify a key, Foundry sends it to OpenAI for authentication. When you run the AI builder, Foundry sends your prompt, the agent instructions, and project-file content needed to perform the requested work to OpenAI.

Those requests are governed by the terms and privacy practices that apply to your OpenAI API account. Do not include secrets, personal information, or confidential source code unless you are authorized to send that information to OpenAI.

Removing the saved API key from Foundry settings deletes Foundry's encrypted local copy. It does not delete information previously processed by OpenAI; use the controls available through your OpenAI account for those requests.

## Updates and downloads

Installed builds may connect to GitHub Releases to check for and download Foundry updates. GitHub may receive standard connection information such as your IP address and request metadata under its own privacy policy.

## Generated applications

Applications generated with Foundry are stored locally. Foundry does not automatically publish, upload, or distribute them. You are responsible for the privacy behavior and disclosures of applications you create and distribute.

## Data sharing and retention

The Foundry project does not operate a backend service and does not receive or sell your prompts, API key, project files, or usage data. Local information remains until you remove it using Foundry, delete the related project files, or uninstall the application and remove its application-data directory.

## Security and questions

Please report security issues using [SECURITY.md](SECURITY.md). For privacy questions, open a public repository issue only if the question contains no sensitive information.

This notice may change as Foundry adds services or integrations. Material changes will be documented in the repository and release notes.
