---
name: cool
description: Deep, thorough, and nit-picky code review of GitHub Pull Requests or local branches/files. Use when given a GitHub PR URL or when requested to review your current local branch or files.
---

# Code Reviewer

Perform high-quality, deep, and thorough code reviews of GitHub Pull Requests or local files and branches. Emulate an expert senior engineer who is exceptionally detail-oriented, constructive, and nit-picky.

## Constraints & Rules

- **GitHub PR Scope (PR URL Provided)**: This is a review-only flow. **Do not make any local file or codebase changes under any circumstances.** All recommendations, fixes, and improvements must be presented as constructive feedback in the final report or as inline review comments on GitHub. The local workspace of the repository being reviewed must remain completely untouched.
- **Local Review Scope (PR URL NOT Provided)**: When no PR URL is provided, the skill is in local review mode. Perform the review, present findings, and **proactively offer to automatically fix selected issues directly in the local workspace.** Only modify files upon receiving clear, explicit confirmation from the user on which issues to address.

## Workflow

Follow these phases sequentially when executing a code review.

### Phase 1: Fetch Changes and Metadata

Determine if a GitHub PR URL is provided. 
- If a PR URL is provided (e.g. starting with `https://github.com/` or of the format `owner/repo/pull/num`), you are in **GitHub PR Review** mode.
- If no PR URL is provided, or is empty (`""`), or if the arguments contain flags like `--staged`, `--branch`, or `--files`, you are in **Local Review** mode.

Run the packaged helper script to retrieve the metadata and diff. Run the command appropriate to the user's requested review scope:

```bash
# A. GitHub PR Review Mode
node /Users/lintly/cool/scripts/pr_helper.cjs fetch <PR_URL>

# B. Local Review Modes
node /Users/lintly/cool/scripts/pr_helper.cjs fetch                       # Default: reviews uncommitted (staged + unstaged) changes, falls back to base branch
node /Users/lintly/cool/scripts/pr_helper.cjs fetch --staged              # Reviews staged/cached changes only
node /Users/lintly/cool/scripts/pr_helper.cjs fetch --branch [name]       # Reviews all commits on current branch compared to target branch (defaults to main/master)
node /Users/lintly/cool/scripts/pr_helper.cjs fetch --files <paths...>    # Reviews specific files (either their diff or full content as a virtual diff)
```

Parse the output JSON, which contains:
- `owner`, `repo`, `prNumber`
- `metadata`: Contains `title`, `body`, `author`, `state`, `baseRefName`, `headRefName`, `headRefOid`, `comments`, `reviews`, `reviewThreads` (which contains GraphQL-fetched review threads including their `isResolved` status and conversation history)
- `diff`: The complete raw diff (or virtual diff for specific files)

### Phase 1.5: Analyze Environment & Pinned Dependency Versions (Mandatory)

Before analyzing any code or suggesting improvements, inspect the workspace and identify pinned major versions of critical dependencies, frameworks, libraries, or cloud providers (e.g. Terraform provider versions).
- **Terraform:** Search for and read configuration files like `terraform.tf`, `providers.tf`, or `versions.tf` to locate pinned `required_providers` blocks (such as the Cloudflare provider version major, e.g., v5 vs v4).
- **Ecosystem Manifests:** For Node.js, Python, Rust, Go, etc., read files like `package.json`, `requirements.txt`, `Cargo.toml`, or `go.mod`.
Ensure all review findings, recommended HCL configurations, API invocations, and syntax patterns align strictly with the pinned major versions in the repository. Do not suggest deprecated, obsolete, or version-incompatible block types or APIs.

### Phase 1.75: Deduplicate Against Resolved Threads (Mandatory)

Prior to starting Phase 2, you MUST carefully inspect `metadata.reviewThreads` in the fetched JSON.
- Identify all review threads that are marked as resolved (`isResolved: true`).
- For any resolved thread, analyze the file path, line number, and the comments (the original feedback and the developer's replies).
- **CRITICAL CONVERGENCE RULE:** You MUST NOT under any circumstances re-flag or repeat comments on an issue that has already been resolved or fixed. For example, if a previous review thread flagged a Python version constraint mismatch (`requires-python <3.14`), the developer fixed/addressed it (e.g., changed to `<3.15`), and resolved the thread, you must NEVER re-comment on that line or file with the same issue. Focus strictly on unresolved threads, or entirely new findings on modified lines. Do not repeat comments that have already been addressed and resolved.

### Phase 2: Systematic Code Review Analysis

Review the diff with extreme diligence. Perform a file-by-file analysis focusing on:

1. **Coding Flaws & Bugs**: Logic errors, edge cases, off-by-one errors, incorrect handling of null/nil values, resource/memory leaks, concurrency race conditions, and error propagation.
2. **Security & Vulnerabilities**: Insecure default configs, SQL injection, XSS, SSRF, broken authentication, lack of authorization, or exposure of sensitive data/secrets.
3. **Performance & Bottlenecks**: Inefficient algorithms (N+1 queries, nested loops), unnecessary allocations, slow database queries, lack of caching, or missing pagination.
4. **Architectural & Style Nitpicks**: Violation of idiomatic style guidelines (Go, TS, Python, Rust, etc.), lack of modularity, poor variable/function naming, or missing tests.

Group findings by severity:
- **Critical**: Security exploits, data corruption hazards, or major system crashes.
- **High**: Definite logic bugs, significant performance bottlenecks, or regression causes.
- **Medium**: Maintainability issues, lack of defensive checks, refactoring suggestions, or test coverage gaps.
- **Low/Nitpick**: Formatting, style preferences, documentation/naming tweaks, and micro-optimizations.

### Phase 3: Interactive Selection and Report Formulation

Present your findings to the user before proceeding with next steps.

1. **Formulate a Detailed Report**: Include a brief summary of the changes, followed by a numbered list of categorized issues. For each issue, specify:
   - **ID**: A sequential number (e.g., `#1`, `#2`).
   - **File**: Path to the file.
   - **Line**: The target line number (as shown in the added/modified portion of the diff).
   - **Severity**: Critical, High, Medium, or Low/Nitpick.
   - **Description**: Clear explanation of the issue, why it is a problem, and a concrete suggestion/fix with code examples.
2. **Ask the User to Select**: Present a clear choice for each issue.
   - **If in GitHub PR Review mode**, ask them which issues they would like to:
     - Post as inline comments to the PR on GitHub.
     - Address locally first (suggesting a plan to fix the code directly).
     - Skip/Ignore.
   - **If in Local Review mode**, ask them which issues they would like to:
     - **Automatically Fix**: Instruct the agent to fix the local code directly.
     - Skip/Ignore.
   Wait for their response using the `ask_user` tool with `multiSelect: true` (always include a 'None / Cancel' option).

### Phase 4: Execution & Finalization

Depending on the mode, proceed as follows:

#### Flow A: GitHub PR Review Mode (PR URL Provided)
Do not submit reviews automatically. Once the user has confirmed their selections:
1. **Construct a Review JSON File**: Write the review payload to a temporary file (e.g., `review.json`). The JSON must follow this schema:
   ```json
   {
     "event": "COMMENT", // Use "APPROVE" if approving, "REQUEST_CHANGES" if requesting changes, or "COMMENT" for general review
     "body": "### Code Review Summary\n\n[Summary of findings]",
     "commit_id": "[headRefOid from Phase 1]",
     "comments": [
       {
         "path": "src/main.js",
         "line": 42,
         "body": "Inline comment body explaining the issue and recommending a fix."
       }
     ]
   }
   ```
2. **Submit the Review**: Execute the helper script to post the review to GitHub:
   ```bash
   node /Users/lintly/cool/scripts/pr_helper.cjs submit <PR_URL> <path-to-review-json>
   ```
3. **Notify User**: Display the success status and the link to the posted GitHub review.

#### Flow B: Local Review Mode (PR URL Empty/Not Provided)
Once the user has selected which issues to automatically fix:
1. **Surgically Apply Fixes**: For each selected issue, make targeted, precise edits to the local files in the workspace (using `replace` or `write_file`). Ensure all fixes adhere strictly to the project's style, architecture, and language standards.
2. **Validate Changes**: After applying modifications, run compile/lint/test commands (such as `npm run lint`, `npm test`, `go test ./...`, etc.) if available in the workspace to verify correctness.
3. **Summarize Fixes**: Present a clear summary of the modified files, applied fixes, and validation test results.
