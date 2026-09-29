---
name: build-from-file
description: Execute scripts, build configurations, and instruction files. Use when asked to run, build, or execute a specific script (.sh, .py, .js), build config (Makefile, package.json, Cargo.toml, go.mod, Dockerfile), or instructional document (.md, .txt).
---

# Build From File

## Overview

The `build-from-file` skill provides unified execution capabilities for standard executable scripts, build configuration files, and instructional markdown runbooks. It automates the detection of file types and triggers the appropriate execution engine, enabling zero-config building and running.

## Development Standards

When using this skill to build or execute code, ensure that all development is **production-ready and robust**. This includes:
- **Error Handling:** Implementing comprehensive error handling, validations, and graceful fallbacks.
- **Security:** Following least privilege principles and never exposing secrets or credentials.
- **Logging & Monitoring:** Emitting clear, structured logs to track execution flow and failures.
- **Testing:** Ensuring changes are backed by automated tests where applicable.
- **Maintainability:** Adhering to clean code practices, performance optimizations, and standard project guidelines.

## Git Workflow

When using this skill to make code changes, you must adhere to the following version control workflow:
1. **Create a new branch:** Always create a new, appropriately named branch for your work (e.g., `git checkout -b feature/update-name`). Do not commit directly to the default branch.
2. **Push to remote:** Once your changes are committed and locally validated, push the branch to the remote repository (e.g., `git push -u origin HEAD`).
3. **Do NOT create a Pull Request (PR):** Stop after pushing the branch. Do not create or open a Pull Request, as the user has manual processes to run on the branch before a PR can be created.

## Main Parameter

This skill accepts a single input:
- `document` (required): The path to the file or configuration document to be executed.

## Supported File Types & Execution Behavior

### 1. Executable Scripts
These are executed directly using their respective system interpreters:
* **Shell Scripts (`.sh`)**: Executed via `bash`.
* **Python Scripts (`.py`)**: Executed via `python3` (or fallback to `python`).
* **Node.js (`.js`, `.cjs`, `.mjs`)**: Executed via `node`.
* **TypeScript (`.ts`)**: Executed via `ts-node` (using `npx`).
* **Ruby/Perl (`.rb`, `.pl`)**: Executed via `ruby`/`perl`.
* **Generic Executables**: If a file has no extension but is executable, it will be executed directly (e.g. `./script`).

### 2. Build Configurations
These files define structured, standard build/run targets:
* **Makefile**: Invokes `make` to execute the default make target.
* **package.json**: Reads scripts and automatically runs `npm run build` or `npm start`. If neither is found, lists available scripts.
* **Cargo.toml**: Invokes `cargo build` to build Rust projects.
* **go.mod**: Invokes `go build` to build Go projects.
* **Dockerfile**: Invokes `docker build -t app-image .` to build a container image.
* **CMakeLists.txt**: Invokes `cmake .` followed by `make` to compile C/C++ projects.

### 3. Instruction Files
These are human- or AI-written text and markdown documents:
* **Markdown (`.md`)**: Parses out standard markdown code blocks (specifically `bash`, `sh`, `shell`, `cmd`, or `powershell`) and executes all commands sequentially.
* **Text Files (`.txt`)**: Logs the content of instructions and guides execution.

---

## Usage Guide

To execute a document, call the bundled helper script `execute.cjs` with the file path as the first argument:

```bash
node scripts/execute.cjs <path-to-document>
```

This helper script automatically performs the routing and execution behavior described above, outputting live stdout/stderr streams.
