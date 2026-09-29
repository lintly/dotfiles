---
name: anal
description: "Review a GitHub PR by number and repo name for Plainsight. Triggers when the user prompts with '/anal pr <number> <repo>' or requests 'anal'."
---

# anal Skill

This skill performs a highly specialized, professional-grade automated code review on a GitHub Pull Request using parallel Antigravity subagents. It is specifically tailored for Plainsight's tech stack: **React/TypeScript**, **Go**, and **Python** (along with **Terraform** for IaC).

---

## 🚀 Step-by-Step Antigravity Workflow

### Step 1: Parse the Request
Parse the user's input/arguments to identify:
1. **PR number** — e.g., `920`, `PR 920`, `#920`
2. **Repository name** — e.g., `plainsight-api`, `client-portal`, `openfilter`

The default GitHub organization for Plainsight is **`PlainsightAI`**.

---

### Step 2: Fetch PR Details
Use the `gh` CLI tool (which is pre-approved and highly reliable) to retrieve PR details, diffs, and existing comments:

1. **PR Metadata**:
   ```bash
   gh pr view <number> --repo PlainsightAI/<repo> --json title,body,baseRefName,headRefName,state
   ```
2. **Full Diff**:
   ```bash
   gh pr diff <number> --repo PlainsightAI/<repo>
   ```
3. **Changed File List**:
   ```bash
   gh pr view <number> --repo PlainsightAI/<repo> --json files
   ```
4. **Existing Comments, Reviews & Resolved Threads** (for deduplication):
   ```bash
   gh api "repos/PlainsightAI/<repo>/pulls/<number>/comments"
   gh api "repos/PlainsightAI/<repo>/pulls/<number>/reviews"
   gh api "repos/PlainsightAI/<repo>/issues/<number>/comments"
   # Fetch GraphQL reviewThreads (specifically including their isResolved status and conversation history):
   gh api graphql -F owner="PlainsightAI" -F repo="<repo>" -F pr=<number> -f query='
     query($owner: String!, $repo: String!, $pr: Int!) {
       repository(owner: $owner, name: $repo) {
         pullRequest(number: $pr) {
           reviewThreads(last: 100) {
             nodes {
               id
               isResolved
               line
               originalLine
               path
               comments(last: 100) {
                 nodes {
                   id
                   body
                   path
                   line
                   state
                   author {
                     login
                   }
                 }
               }
             }
           }
         }
       }
     }
   '
   ```

---

### Step 3: Project Detection & Context
Analyze the changed files to determine the specific project context:
- `client-portal` or `*.tsx`/`*.ts` + `package.json` → **React/TypeScript UIX**
- `plainsight-api` or `openfilter-pipelines-controller` or `*.go` + `go.mod` → **Go backend / microservice**
- `openfilter` or `filter-*` or `*.py` + `requirements.txt`/`pyproject.toml` → **Python core library / vision filter**
- `*.tf` or `infrastructure` or `gitops` → **Terraform IaC / GitOps**

*Note: If a `CLAUDE.md` exists in the local workspace or repository root, check it for specific project and style conventions.*

---

### Step 4: Re-Review & Comment Deduplication
Check if this is a re-review by looking at existing PR comments/reviews and GraphQL review threads. 
If any review thread on a specific file and line has `isResolved` set to `true`, or if an earlier review by an AI agent exists:
1. Parse all prior comments, their replies, and their resolution status.
2. Identify resolved threads (`isResolved: true` from the GraphQL reviewThreads nodes).
3. **CRITICAL CONVERGENCE RULE:** You MUST NOT under any circumstances re-flag, repeat comments on, or re-review issues that are already resolved. For example, if a previous review thread flagged a Python version constraint mismatch (`requires-python <3.14`), the developer fixed/addressed it (e.g. changed to `<3.15`), and resolved the thread, you must NEVER re-comment on that line or file with the same issue. Focus strictly on unresolved threads, or entirely new findings on modified lines.
4. Classify each unresolved reply as:
   - **DISMISSAL** — e.g., "not applicable", "won't fix", "disagree", "intentional", "by design", "out of scope", "nit", "not worth", "ignore", "skip this", "leaving as-is".
   - **ACKNOWLEDGMENT** — e.g., "agree", "will fix", "done".
5. Track the set of dismissed issues: `{path, line_range, issue_summary}`. If the code at that location has NOT changed since dismissal, **do not re-flag it**. If the code has changed, re-evaluate it fresh.

#### ⚠️ RE-REVIEW CONCISENESS RULE
If the re-review confirms that all previous comments were successfully addressed and no new issues are found (especially when approving the PR):
- Do **NOT** generate a verbose, detailed recap of every single previously-mentioned issue.
- The review summary comment, artifact report, and chat presentation must be **extremely concise** — just a few lines stating that all previous comments were addressed, no new problems were found, and the PR is approved/commented is fully sufficient.


---

### Step 5: Code Review Phase — Spawn Reviewer Agent Team
Spawn the **9 specialized reviewer subagents** in parallel. Use the `invoke_subagent` tool with `TypeName: "self"` (which inherits full capabilities, tools, and prompts).
Each reviewer agent focuses on a single aspect of the code, guided by the following guidelines:
- **Diff to Review**: The relevant slice or full PR diff.
- **Project Context**: Tech stack, detected language, and any local conventions.
- **Reviewer Focus & Instructions** (listed below).
- **Conciseness Directive**: Keep all reviews extremely concise and to the point. Avoid verbose, wordy explanations. Focus purely on the issue and the recommended fix using minimal, punchy sentences.

#### 👥 Reviewer Definitions

---

#### 1. REVIEWER: best-practices
- **Focus**: Language, framework, and tooling best practices. Look for anti-patterns, API misuse, idiomatic style, and project conventions.
- **Tech-Stack Guidelines**:
  - **React/TypeScript**: Adherence to React 18+ hooks, proper component lifecycle usage, functional components, avoiding old class-based patterns, clean import structures.
  - **Go**: Proper Go idioms (e.g., standard error checking pattern), effective use of interfaces, idiomatic naming (camelCase, short receiver names), context usage.
  - **Python**: PEP 8 compliance, snake_case naming, idiomatic generator/comprehension usage, proper asyncio constructs.
- **Flag**:
  - **🔴 BLOCKING**: Severe anti-patterns that will introduce tech debt, breaking changes, or violations of core architectural layering.
  - **🟡 IMPORTANT**: Non-idiomatic code, inconsistent patterns, or missing use of standard library/project-standard utilities.
  - **🟢 SUGGESTION**: Style inconsistencies, minor naming improvements, code readability enhancements.

---

#### 2. REVIEWER: dry
- **Focus**: Duplicated logic, repeated functions, or copy-pasted blocks.
- **CRITICAL RULE**: DRY violations must **ONLY** be flagged if a piece of logic or code is repeated **3 or more times**. 
- **CRITICAL RULE**: A 2-time repetition is **perfectly acceptable** and should **NEVER** be flagged.
- **Flag**:
  - **🔴 BLOCKING**: Long identical code blocks (10+ lines) duplicated in **3 or more** changed files.
  - **🟡 IMPORTANT**: Near-identical code blocks (5+ lines) differing only in variable names duplicated in **3 or more** files/locations. Magic strings or numbers repeated 3+ times.
  - **🟢 SUGGESTION**: Minor repetition (2-4 lines) repeated 3+ times that could easily be extracted.

---

#### 3. REVIEWER: error-handling
- **Focus**: Robustness of error propagation, handling, logging, and failure paths.
- **Tech-Stack Guidelines**:
  - **React/TypeScript**: Catching Promise rejections, using Error Boundaries, handling API error responses gracefully in the UI.
  - **Go**: Proper error checking (`if err != nil`), error wrapping (`fmt.Errorf("context: %w", err)`), not swallowing errors (e.g., assigning to `_` or logging and continuing on fatal paths).
  - **Python**: No bare `except:` blocks, proper context managers (`with`), catching specific exceptions (e.g., `KeyError`, `ValueError`).
- **Flag**:
  - **🔴 BLOCKING**: Swallowed exceptions, completely silent failures, empty catch/except blocks, continuing critical paths after a fatal error without returning.
  - **🟡 IMPORTANT**: Missing error wrapping, vague error messages, unhandled promise rejections, lack of user/system logging on failure.
  - **🟢 SUGGESTION**: Better logging context, minor improvements to error messages.

---

#### 4. REVIEWER: functionality
- **Focus**: Correctness, business logic flow, off-by-one errors, boundary conditions, race conditions, and unhandled edge cases.
- **Flag**:
  - **🔴 BLOCKING**: Logical bugs producing incorrect outputs, off-by-one errors in loops, null/nil/undefined pointer dereferences, race conditions, corrupt state mutations.
  - **🟡 IMPORTANT**: Unhandled edge cases (empty lists, nil maps, division by zero, negatives), conditional logic missing fallback cases, async race conditions.
  - **🟢 SUGGESTION**: Simplified/clearer logic flow, early guard clauses to avoid deep nesting.

---

#### 5. REVIEWER: test-coverage
- **Focus**: Test adequacy, coverage of critical paths, test quality, and assertions.
- **Tech-Stack Guidelines**:
  - **React/TypeScript**: React Testing Library / Vitest tests for newly added interactive components.
  - **Go**: Table-driven tests (`t.Run`), testing happy and failure paths.
  - **Python**: Pytest-style unit tests, proper mocking of I/O or APIs.
- **Flag**:
  - **🔴 BLOCKING**: New public API endpoints, major business service methods, or complex logic blocks with zero tests. Disabled/commented-out tests.
  - **🟡 IMPORTANT**: Missing negative/failure test cases, missing edge case tests (empty, null, boundary values), tests tightly coupled to implementation.
  - **🟢 SUGGESTION**: Descriptive test names, cleaner setup/teardown, parameterized test suggestions.

---

#### 6. REVIEWER: type-design
- **Focus**: Strong type safety, expressing invariants, and preventing invalid states via the compiler.
- **Tech-Stack Guidelines**:
  - **TypeScript**: Avoiding `any`, `Object`, or raw `unknown` where specific interfaces/types can be used. Using discriminated union types and enums instead of multiple booleans.
  - **Go**: Proper struct definitions, clear interfaces, typing domain IDs (e.g., `type OrganizationID string` rather than raw strings) where appropriate.
  - **Python**: Proper type hints (using the `typing` module or PEP 585/604), Pydantic models for validation at boundaries.
- **Flag**:
  - **🔴 BLOCKING**: Using `any` in TypeScript, returning untyped responses on public APIs, structures allowing invalid domain states.
  - **🟡 IMPORTANT**: Mutable public state, generic interfaces where specific structures are needed, inconsistent typing for identical concepts.
  - **🟢 SUGGESTION**: Minor type-safety refactors, type alias readability, branding/nominal types.

---

#### 7. REVIEWER: performance
- **Focus**: Inefficiencies, CPU/Memory bottlenecks, database operations, and frontend responsiveness.
- **Tech-Stack Guidelines**:
  - **React/TypeScript**: Unnecessary React re-renders, missing `useMemo`/`useCallback` on heavy computations, deep tree updates, large payload parsing.
  - **Go**: Goroutine leaks, inefficient channel usage, string concatenation in loops, excessive heap allocations (struct copying vs pointer passing), missing DB indexes.
  - **Python**: Sync functions blocking the async event loop, O(N^2) algorithms, redundant lists creation/copying, missing pagination on DB calls.
- **Flag**:
  - **🔴 BLOCKING**: Algorithmic complexity issues (e.g., O(N^2) on large user inputs), obvious goroutine/memory leaks, N+1 query patterns.
  - **🟡 IMPORTANT**: Missing caching for heavy operations, missing database indexes on queried fields, lack of API response pagination.
  - **🟢 SUGGESTION**: Minor micro-optimizations, using string builders, caching suggestions.

---

#### 8. REVIEWER: security
- **Focus**: Security vulnerabilities, safe data handling, and input sanitization.
- **Flag**:
  - **🔴 BLOCKING**: SQL injection (e.g., string formatting directly in Go raw SQL), Cross-Site Scripting (XSS), Command injection (unsafe subprocessing), hardcoded secrets/API tokens, missing role/auth checks on new routes.
  - **🟡 IMPORTANT**: Insufficient input sanitization/validation at boundaries, vulnerable third-party dependencies, loose CORS/CSRF configurations, predictable random numbers in crypto contexts.
  - **🟢 SUGGESTION**: Defense-in-depth improvements, principle of least privilege recommendations.

---

#### 9. REVIEWER: adr
- **Focus**: Comparing the code implementation against the official Platform Architecture Decision Records (ADRs) to ensure compliance.
- **ADR Reference Rules**:
  - **ADR-007 (Metrics Backend Consolidation)**: VictoriaMetrics is the sole metrics engine. 3 instances must be run split by ownership (never mixed): (a) customer/business with tenant-guard (`relabel-configmap.yaml`); (b) system (`victoria-metrics-system` keyed by `pipeline_instance_id` for per-instance filter FPS, CPU, GPU, RAM, latency); (c) platform/SRE for infrastructure. Keep Prometheus operator CRDs (ServiceMonitor, PodMonitor, PrometheusRule). VMAgent replaces Prometheus server for scraping. VMAlert evaluates rules. Drop GCM and Mimir.
  - **ADR-008 (Model Artifact Delivery & Image-Volume Graph Schema)**: Kubernetes `image` volume mount (Option B) is the primary delivery mechanism. Node schema must use nested `source` shape: `{ source: { kind: "trained | image", model_artifact_id: "<uuid>", image: "<ref>", pull_secret: "<secret>" }, mount_path: "/absolute/path" }`. Export resolver (PLAT-1100) resolves to immutable `uri@digest` and freezes digest at snapshot.
  - **ADR-010 (External Telemetry Credentials)**: External clusters push OTLP system metrics using a Plainsight-issued, telemetry-scoped per-org credential delivered on the existing scoped-token rail (same as `org-event-ingestion` and `org-training`) and validated in our own layer behind Gateway (no Google-issued credential, e.g., service account key, for telemetry on customer side). Under Option B (for connected clusters) a dedicated telemetry service account can be used with locally signed service account JWTs.
- **Flag**:
  - **🔴 BLOCKING**: Severe architecture violations (e.g., using GCP-specific components for metrics off SaaS, mixing metrics domains, leaking vector-store credentials/clients to customer-side services, introducing Google SA dependencies on customer hardware for telemetry, using flat schema instead of nested `source` in graph models).
  - **🟡 IMPORTANT**: Suboptimal compliance (e.g., missing digest freeze on snapshots, using incorrect tier labels in docs or code, e.g., "air-gapped" or "fully on-prem" instead of "Hybrid" for CPD 1.0, not keying system metrics properly by `pipeline_instance_id`).
  - **🟢 SUGGESTION**: Documentation alignment, style improvements, adding references to ADR docs in comment strings or READMEs.

---

### Step 6: Aggregate and Filter Results
Once all 9 subagents report back:
1. **Deduplicate**:
   - If multiple reviewers flag the same line, merge into a single issue. Keep the highest severity and credit both reviewers.
2. **Filter Out**:
   - Out of scope: untouched files or theoretical concerns unrelated to the PR.
   - 2-time DRY repetitions (ensure they are completely ignored).
   - Standard idiomatic patterns used correctly.
   - Pre-existing code patterns the PR merely touches but doesn't change.
   - Dismissed-review comments that haven't had code changes.
   - Comments already posted on the PR by other reviewers.
3. **Sort**:
   - Group by severity: **🔴 BLOCKING**, **🟡 IMPORTANT**, **🟢 SUGGESTION**.

---

### Step 7: Create the Review Artifact
Generate a markdown artifact file under `<appDataDir>/brain/<conversation-id>/review_results.md` to hold the complete structured findings:

```markdown
# 🔍 Code Review: PlainsightAI/{repo}#{{number}}

---

## 📊 Summary of Findings
- **🔴 BLOCKING (Critical)**
- **🟡 IMPORTANT (Warning)**
- **🟢 SUGGESTION (Info)**

---

## 🚀 Key Action Items
1. {Action item 1}
2. {Action item 2}
3. {Action item 3}

---

## 🌟 Positive Highlights
- **{Highlight 1}**: {details}
- **{Highlight 2}**: {details}

---

## 🛠️ Detailed Review Comments

### {SEVERITY_EMOJI} {Issue Title}
- **Location**: [`{file_path}:{line}`](file:///{full_path}#L{line}) (`{reviewer_names}`)
- **Description**: {brief_issue_explanation_and_rationale}

**Recommended Fix:**
```typescript
{fixed_snippet}
```

---
```

---

### Step 8: Present and Ask for User Approval
Present the high-level summary and the priority action items from the artifact directly in the chat.

Provide a numbered list of the detailed findings so the user can easily see which comments correspond to which numbers.

Always present the user with exactly two options for posting findings:
1. **Option 1**: Post all findings with severity **🔴 BLOCKING** and **🟡 IMPORTANT** (ignore suggestions).
2. **Option 2**: Manually specify which findings to post (e.g., by listing specific numbers, such as "Post comments #1 and #3").

Instruct the subagents and yourself to strictly wait for the user's choice and only post the comments corresponding to their selected option.

---

### Step 9: Post Comments to GitHub
Based on the user's choice:
1. Get the current head commit SHA:
   ```bash
   COMMIT_SHA=$(gh pr view <number> --repo PlainsightAI/<repo> --json headRefOid -q .headRefOid)
   ```
2. **Do NOT Post Metadata, Suggestions, Severity Categories, or Counts in Summary Comment:** Under no circumstances should unposted suggestions, findings, notes, severity categories, severity counts, or PR metadata (such as the PR title, status, and branch names) be included in the overall review's summary comment/body. The summary comment must remain an extremely brief, high-level overview of the review itself, containing NO code suggestions, severity categories, severity counts, or PR metadata.
3. **Single Unified Review Post (Guarantees Chronological Order):** Submit the entire review (the summary body and only the explicitly chosen inline comments) in a single unified API call to the Pull Request Reviews endpoint:
   ```bash
   gh api "repos/PlainsightAI/<repo>/pulls/<number>/reviews" --input - <<EOF
   {
     "commit_id": "$COMMIT_SHA",
     "event": "COMMENT",
     "body": "[summary body text]",
     "comments": [
       {
         "path": "path/to/file",
         "line": <line>,
         "body": "[inline comment text]",
         "side": "RIGHT"
       }
     ]
   }
   EOF
   ```
   *Note:* 
   - Set the `event` parameter to `"APPROVE"` if the user chose Approve, and `"COMMENT"` if they chose Comment.
   - Format each inline comment to be very concise and to the point. Include its severity emoji, a brief description referencing the file and line, and the recommended fix. **Do NOT include or display the current code.** Keep it short, focused, and free of conversational fluff.
   - Format of inline comment:
     ```
     {SEVERITY_EMOJI} {Issue Title} (at {file_path}:{line})
     {brief_issue_explanation}

     ```typescript
     // Recommended Fix:
     {fixed_snippet}
     ```
     *Automated Cloud Review*
     ```
   - Creating a unified review places the summary body chronologically at the top, with all select inline comments grouped cleanly below it.

---

### Step 10: Final Confirmation
Once complete, confirm to the user:
- The final action taken (Approve / Comment / Skip).
- List of posted comments by severity (without counts).
- Clickable markdown links to the posted comments on GitHub.
