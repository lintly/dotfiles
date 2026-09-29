---
name: check-my-lint
description: Validates formatting, style, and linting issues across JavaScript/TypeScript, Python, Go, and Rust. Use when verifying code quality, identifying style violations, or formatting modified files.
---

# Check My Lint

This skill provides automated and surgical checking of code formatting, style, and linting across multiple language ecosystems (JS/TS, Python, Go, and Rust). It helps you maintain code quality and ensure changes match local repository standards.

## Workflow

### 1. Automated Detection and Verification
The skill includes a highly robust helper script `scripts/check_lint.cjs` that automatically detects project contexts, identifies configured toolchains, and executes appropriate checks.

**Command Syntax:**
```bash
node <path_to_skill>/scripts/check_lint.cjs [--fix] [--files <file1> <file2> ...]
```

- **Check Only (Default):** Runs all available project-level linters and formatters in read-only/check mode.
- **Auto-Fix (`--fix`):** Runs linters with auto-fix enabled (e.g., `--fix`, `--write`) and formatters to rewrite style violations in-place.
- **Surgical Mode (`--files`):** Limits checks specifically to the list of files provided. Highly recommended for targeting only modified files during PRs or small edits.

### 2. Manual Fallback Reference
If you need to run specific commands manually or the helper script encounters environment constraints, use the following industry-standard patterns:

#### JavaScript / TypeScript
- **ESLint:**
  - Check: `npx eslint .` or `npm run lint`
  - Fix: `npx eslint --fix .`
- **Prettier:**
  - Check: `npx prettier --check .`
  - Fix: `npx prettier --write .`

#### Python
- **Ruff (Preferred):**
  - Check: `ruff check .` and `ruff format --check .`
  - Fix: `ruff check --fix .` and `ruff format .`
- **Black & Isort:**
  - Check: `black --check .` and `isort --check .`
  - Fix: `black .` and `isort .`
- **Flake8:**
  - Check: `flake8 .`

#### Go
- **gofmt:**
  - Check: `gofmt -d .`
  - Fix: `gofmt -w .`
- **golangci-lint:**
  - Check: `golangci-lint run`
  - Fix: `golangci-lint run --fix`

#### Rust
- **cargo fmt:**
  - Check: `cargo fmt -- --check`
  - Fix: `cargo fmt`
- **clippy:**
  - Check: `cargo clippy -- -D warnings`

## Agentic Ergonomics

- **Surgical Execution:** Prioritize using `--files` with the specific files you modified. This avoids wasting tokens, time, and CPU cycles linting unrelated parts of a massive codebase.
- **Automated Validation:** Always run this skill's checks after making any significant code changes to verify you haven't introduced styling or syntax errors.
- **Self-Correction:** If linting fails, read the truncated error logs, locate the lines of code causing the violation, apply fixes, and re-run validation. Do not complete a task until all checks pass cleanly.
