---
name: go-validate-harden
description: Audit, secure, and optimize Go input validation functions. Use when working on custom schema/format validators, fixing path traversal vulnerabilities, writing Go native fuzz tests (testing.F), or expanding static analysis linters to automate security reviews.
---

# Go Validate Harden

## Overview

This skill provides procedural guidelines and templates to audit, secure, and optimize input validators in Go. It automates vulnerability detection, introduces fuzz testing protocols, and expands static analysis checks to ensure thread safety and robust parser security.

## Auditing Guidelines

Perform a systematic review of Go validation logic by checking against the following vulnerability and optimization vectors:

### 1. Input Validation Bypasses & Path Traversal
- **Parent Directory References:** Search for missing path traversal checks. Any string representing a local path, device file, IPC socket, or cloud URI (e.g., GCS/S3) must be explicitly checked for parent references (`..`).
- **Consecutive Delimiters:** Ensure consecutive slashes (`//`) or dots (`..`) are disallowed in custom device paths or bucket names.
- **Trailing Delimiters:** Check for trailing slashes (`/`) or dots (`.`) in formats that require strict boundaries (e.g. webcam or bucket identifiers).
- **Strict Format Fallbacks:** Ensure that if an unrecognized format is passed, the validator returns a strict error (e.g. `unrecognized schema format`) rather than silently bypassing validation.

### 2. Thread-Safety & Registries
- **Map Concurrency:** Ensure validation function registries (maps) are unexported and strictly read-only after initialization to avoid concurrency races.
- **Error Sanitization:** Ensure errors containing raw user input (like basic authentication credentials) are wrapped in thread-safe sanitization objects rather than utilizing shared mutable state.

### 3. Go Parallel Testing Pitfalls
- **Loop Variable Capture:** In table-driven tests that use `t.Parallel()`, verify that the loop variable is properly shadowed (e.g. `tt := tt` or `vector := vector`) before executing the subtest goroutine.
- **Subtest Concurrency:** Run subtests in parallel to reduce test execution times and quickly highlight race conditions.

### 4. Regular Expression Performance
- **Non-Capturing Groups:** Optimize all validation regexes by replacing standard capturing groups `(...)` with non-capturing groups `(?:...)` when the matches are only checked for conformance rather than extracted.

---

## Workflow: Implementing Go Fuzz Testing

Fuzzing is the most efficient way to discover boundary-edge validation bypasses. Follow this workflow to implement native Go fuzzing:

### Step 1: Create the Fuzz Test File
Create a `*_fuzz_test.go` file adjacent to the validator code.

### Step 2: Implement the Fuzz Target
Write a fuzz test targeting the main validator entrypoint. Use a representative seed corpus of both valid and invalid values.

```go
package formats

import (
	"testing"
)

func FuzzValidateInput(f *testing.F) {
	// 1. Seed Corpus
	f.Add("rtsp://localhost:554/stream")
	f.Add("file:///data/video.mp4")
	f.Add("")
	f.Add("ipc:///tmp/../../etc/passwd")

	// 2. Fuzzing Target
	f.Fuzz(func(t *testing.T, input string) {
		// Verify that Validate never panics under arbitrary inputs
		_ = Validate("your-format-name", input)
	})
}
```

### Step 3: Run the Fuzzer
Execute the fuzz test locally with a timeout:
```bash
go test -v -run=FuzzValidateInput -fuzz=FuzzValidateInput -fuzztime=10s ./...
```

---

## Workflow: Expanding Static Analysis

To automate verification and block security regressions before code review:

### Step 1: Add High-Value Linters
Add `gocritic`, `gosec`, `goconst`, and `govet` to your `.golangci.yml` file:
```yaml
linters:
  enable:
    - gosec      # Catches path traversals and credentials
    - gocritic   # Catches regex capturing groups and switch-to-if optimizations
    - goconst    # Catches repeated hardcoded string literals
    - govet      # Standard compiler vet checks
```

### Step 2: Run Local Validation
Ensure code passes the updated linter suite:
```bash
golangci-lint run ./...
```
