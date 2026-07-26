# Foundry Desktop — MVP product specification

## Promise

Describe a desktop tool, watch it run locally, refine it in conversation, and export a standalone installer.

## First user

A Windows user who needs a focused personal or internal tool but does not want to learn a native build system.

## First successful workflow

1. Create a project from the supported Tauri + React template.
2. Describe a change in plain language.
3. Review the agent's plan and file activity.
4. Run automated checks and repair compilation errors.
5. Launch a local preview.
6. Restore any previous checkpoint.
7. Export a Windows installer.

## MVP boundaries

- Windows builder first.
- One generated-app stack: Tauri, React, and TypeScript.
- Local projects and source ownership.
- Controlled tools instead of unrestricted model shell access.
- No collaboration, marketplace, cloud workspaces, or macOS build workers in the first release.

## Safety model

The agent may read and search the active project, apply structured patches, create files inside approved directories, and invoke allow-listed package scripts. Destructive operations, external directories, credential access, and arbitrary shell commands require explicit approval or remain unavailable.

