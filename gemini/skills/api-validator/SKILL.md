---
name: api-validator
description: Format Go code, regenerate and update OpenAPI specifications, Go client libraries, scopes, and SQLC repositories, and run verification tests. Use this skill when working on Plainsight API routes, OpenAPI spec, Go client, database schema, or when code changes need validation.
---

# API Validator

This skill coordinates formatting, OpenAPI/client generation, and test validation for the Plainsight API codebase.

## Workflows

### 1. Format Code
Always format code before checking generate status or running tests:
- **Format Code**: Run `make fmt`
- **Verify Format**: Run `make fmt.check`

### 2. Generate and Verify API/OpenAPI Code
If API endpoints, routing, policy CSVs, or SQL files are modified:
- **Regenerate Files**: Run `make generate` to update the OpenAPI spec, client, scopes, and SQLC repositories.
- **Verify Integrity**: Run `make generate.check` to confirm generated files are completely up-to-date.
- **Troubleshooting**: If `make generate` strips OAuth consent endpoints (due to `OAUTH_ENABLED` or `VALKEY_ADDR` missing), export required env variables:
  ```bash
  openssl genpkey -algorithm Ed25519 -out /tmp/oauth_priv.pem
  openssl pkey -in /tmp/oauth_priv.pem -pubout -out /tmp/oauth_pub.pem
  export OAUTH_ENABLED=true \
         OAUTH_ISSUER_URL=https://api.prod.plainsight.tech \
         OAUTH_SIGNING_KEY_PATH=/tmp/oauth_priv.pem \
         OAUTH_SIGNING_KEY_PUBLIC_PATH=/tmp/oauth_pub.pem \
         OAUTH_KEY_ID=local-test \
         OAUTH_CONSENT_URL=https://app.prod.plainsight.tech/oauth/consent \
         VALKEY_ADDR=127.0.0.1:6379
  make generate
  ```

### 3. Run and Validate Tests
Verify that changes do not introduce regressions by running appropriate test suites:
- **Run All Local Tests**: Run `make local.test`
- **Run Server Tests Only**: Run `make local.test.server`
- **Run CLI Tests Only**: Run `make local.test.cli`
- **Docker Integration Tests**: Ensure Supabase/DB is running via `make supabase.start` or `make compose.up.db` if tests require it, or execute integration tests in isolated Docker containers via `make compose.test.run`.
