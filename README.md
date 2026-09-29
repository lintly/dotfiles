# Dotfiles & AI Agent Environment Setup

Personal configuration repository and dotfiles managing development environments and machine-level AI agent setups across workstations.

---

## 📌 Overview

This repository centralizes and synchronizes developer configurations, CLI utilities, and AI assistant settings (specifically for **Gemini CLI** / Antigravity). It ensures consistent workflows, specialized domain skills, custom extensions, and toolchain configurations across different machines.

---

## 📂 Repository Structure

```text
dotfiles/
├── gemini/                        # Gemini CLI configuration & runtime environment
│   ├── settings.json              # Global CLI settings, security/auth configs, and MCP servers
│   ├── trustedFolders.json        # Trusted workspace directories
│   ├── projects.json              # Registered project metadata
│   ├── extensions/                # Installed Gemini CLI extensions
│   │   ├── extension-enablement.json
│   └── skills/                    # Custom agent skills for specialized developer workflows
│       ├── anal/                  # Specialized GitHub PR review for Plainsight tech stack
│       ├── api-validator/         # OpenAPI generation, SQLC update, Go formatting & validation
│       ├── build-from-file/       # Unified execution runner for scripts, configs, and runbooks
│       ├── check-my-lint/         # Multi-language linter & style checker (JS/TS, Python, Go, Rust)
│       ├── cool/                  # In-depth, nit-picky automated code reviewer for PRs & local changes
│       ├── fuck/                  # PR review feedback resolution & comment response workflow
│       ├── go-validate-harden/    # Security auditing, path traversal prevention & Go fuzz testing
│       └── plainsight-api-reviewer/ # Architectural & resiliency review rules for Plainsight APIs
└── README.md                      # Repository documentation
```

---

## 🤖 Gemini CLI & AI Assistant Setup

The `gemini/` directory configures Gemini CLI as an AI pair programmer and automation assistant.

### 1. Settings & MCP Integrations (`gemini/settings.json`)
- **Authentication**: Configured for enterprise authentication (e.g., Vertex AI).
- **MCP Server Integrations**: Preconfigured Model Context Protocol (MCP) servers (such as Atlassian MCP for Jira & Confluence access).

### 2. Custom Agent Skills (`gemini/skills/`)
Skills provide domain-specific instructions, workflows, and automated tooling:
- **`anal`**: Performs deep multi-agent automated code reviews on GitHub Pull Requests for React, TypeScript, Go, Python, and Terraform projects.
- **`api-validator`**: Enforces Go formatting (`make fmt`), regenerates OpenAPI specifications, Go client libraries, SQLC repos, and validates route schema integrity.
- **`build-from-file`**: Auto-detects and executes scripts, build configs (`Makefile`, `package.json`, `Cargo.toml`, `Dockerfile`), and interactive runbooks.
- **`check-my-lint`**: Multi-ecosystem lint and style detection runner across JavaScript, TypeScript, Python, Go, and Rust.
- **`cool`**: Detailed code reviews with optional proactive workspace autofixes.
- **`fuck`**: Streamlines PR iteration by inspecting unresolved comments on the current branch, applying targeted fixes, running validation suites, and drafting reviewer responses.
- **`go-validate-harden`**: Audits and hardens Go input validation routines against path traversal, delimiter bypasses, and concurrency flaws.
- **`plainsight-api-reviewer`**: Validates security allowlists, dynamic auth challenges, lock-free memory safety, and hot-path initialization patterns.

### 3. Extensions (`gemini/extensions/`)
- **`code-review`**: Provides built-in `/code-review` and `/pr-code-review` slash commands for instant code analysis.

---

## 🚀 Setup & Installation

To link this setup to your local Gemini CLI environment:

1. **Clone the repository:**
   ```bash
   git clone <repo-url> ~/dotfiles
   ```

2. **Symlink or sync the configuration:**
   Symlink the `gemini` directory to your active Gemini configuration path (typically `~/.gemini` or custom profile directory):
   ```bash
   ln -s ~/dotfiles/gemini ~/.gemini
   ```

3. **Verify Configuration:**
   Launch Gemini CLI in any workspace to verify loaded skills and extensions:
   ```bash
   gemini
   ```

---

## 🔒 Security Best Practices

- **Credentials & Tokens**: Sensitive credential files, OAuth tokens (e.g., `mcp-oauth-tokens.json`), and local cache folders should remain gitignored and never committed.
- **Permissions**: Verify file permissions when deploying symlinks across multi-user environments.
