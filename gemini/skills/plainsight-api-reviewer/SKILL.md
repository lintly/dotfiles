---
name: plainsight-api-reviewer
description: Enforces Plainsight API-specific architectural, security, and quality standards during code changes, reviews, or OCI/ORAS pulls. Use when reviewing code changes, refactoring Go service methods, or implementing OCI/ORAS integrations in the plainsight-api codebase.
---

# Plainsight API Architecture & Resiliency Review

When reviewing, writing, or refactoring code in the Plainsight API repository, you MUST enforce the following standards to ensure security, resilience, and determinism.

## 1. Security & Credential Isolation (Leakage Protection)
- **Mandate**: All dynamic auth challenges (e.g., `auth.CredentialFunc`) MUST validate the target `host` against a permitted Google allowlist before returning a token.
- **Rule**: Port suffixes (e.g., `:443`) must be stripped first. Google Artifact Registry (GAR) regional domains must explicitly end in `-docker.pkg.dev` to prevent wildcard cross-tenant exposure on general `.pkg.dev` subdomains.
- **Allowed Domains**: `gcr.io`, `*.gcr.io`, `*-docker.pkg.dev`.

## 2. Resilient Initialization & Concurrency (Hot Paths & Cold Starts)
- **Mandate**: Protect hot paths from mutex contention and prevent wasted work on cold starts.
- **Pattern**:
  - **Cold Starts**: Implement double-checked locking around network I/O initialization to prevent concurrent callers from executing the initialization block multiple times.
  - **Hot Paths**: Use `atomic.Pointer` for read-heavy state (like cached clients) to ensure lock-free memory safety.
  - **No Permanent Error Caching**: Never use `sync.Once` to cache client instances if the initialization process performs external network I/O. Caching errors permanently makes the process unrecoverable.

## 3. Cancellable Challenge Lifetimes & Timeouts (Bounded Contexts)
- **Mandate**: Ensure all network calls and token refresh operations respect context cancellation and use explicit timeouts.
- **Pattern**:
  - Always wrap dynamic token-refresh requests in a goroutine and select on the passed challenge request context (`credsCtx.Done()`). Use a buffered channel of size 1 to prevent goroutine leaks.
  - HTTP clients downloading large blobs MUST have bounded read timeouts (e.g., `http.Client.Timeout`) and must respect request contexts.

## 4. OCI Referrer & Ingestion Determinism
- **Mandate**: 
  1. **Deterministic Selection**: Use the OCI `org.opencontainers.image.created` timestamp annotation to select the newest referrer. Fall back to lexicographically sorting by digest *only* if timestamps are missing or identical.
  2. **Strict Manifest Routing**: Always fetch manifests via `repo.Manifests()` explicitly rather than `repo` to ensure OCI endpoint compatibility.
  3. **Strict Size Boundaries**: Reject descriptors where `Size <= 0` up front (or use `repo.Resolve` to rehydrate missing fields on legacy descriptors). Enforce strict upper boundaries (e.g., `Size <= 5MB`) on both manifest and layer fetches *before* attempting the download.
  4. **Strict Media-Type Fallbacks**: Do not blindly guess media types (e.g., `application/octet-stream`) in multi-layer artifacts. Explicitly verify the media type and short-circuit with an error if ambiguous.

## 5. Schema Validation & Error Classification
- **Mandate**: Decouple syntactic/structural validation from configuration parameter extraction.
- **Rules**:
  - **Validation Asymmetry**: Ensure `SchemaKindOutput` and `SchemaKindConfig` have symmetric structural checks where appropriate.
  - **Strict URI Matching Relaxed**: Validate the `$schema` URI but permit standard variants (e.g., `http://` vs `https://` and trailing `#`).
  - **Null Safeguards**: explicitly prevent `null` JSON literals from bypassing validation.
  - **Error Classification (4xx vs 5xx)**: Do not trigger retry storms by returning `InternalError` (HTTP 5xx) for bad upstream data (e.g., empty manifests, no schema layers, invalid JSON). These MUST map to `InvalidInputError` (HTTP 4xx).

## 6. Testing & Isolation Integrity
- **Mandate**: Ensure tests remain perfectly isolated and mocked dependencies reflect real-world constraints.
- **Rules**:
  - **Global Isolation**: If overriding globals like `os.Setenv` or `http.DefaultTransport`, ALWAYS use `t.Cleanup()` to restore the original state.
  - **Valid Mocks**: Hardcoded mocks (e.g., SHA-256 digests) MUST be syntactically valid (e.g., exactly 64 hex characters for SHA-256).

## 7. Plainsight Structlint & Code Quality Guidelines
Always verify changes do not violate these custom repository linter rules (enforced by `go run ./tools/structlint ./...`):
- **`ctxchain`**: NEVER use `context.Background()` or `context.TODO()` inside a block that already has a `context.Context` parameter. Use the in-scope `ctx`, or `context.WithoutCancel(ctx)` to detach cancellation while preserving spans and tracing IDs.
- **`nostdlog`**: Do not import the standard library `"log"` package. Use `"github.com/PlainsightAI/plainsight-api/pkg/log"` for structured logging.
- **`noprint`**: Rejects `fmt.Print` / `Printf` / `Println`. Use structured logging or `fmt.Fprint*` with an explicit writer.
- **`spannames`**: Rejects raw string literals in `tracing.StartSpan`. Always use a package-specific named constant from your package's `tracing.go` file.
- **`spanidiom`**: Do not import `otel` or `otel/trace` directly. Use custom `tracing.Stamp` and `tracing.StartSpan` helpers.
- **`exhaustive` Switches**: Switches on typed string/int enums must cover all constants. `default` branches do not signify exhaustiveness. Enforce switch checks with a `//exhaustive:enforce` annotation.
- **Domain Errors**: Use custom constructors from `github.com/PlainsightAI/plainsight-api/pkg/errors` (e.g., `pkgerrors.InternalError`, `pkgerrors.InvalidInputError`) rather than returning plain raw errors.

