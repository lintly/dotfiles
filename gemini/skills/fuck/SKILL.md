---
name: fuck
description: Reviews the PR assigned to the current branch, implements open feedback/comments, validates codebase (tests, linting, coverage), and helps respond to PR comments after user review. Use when working on a git repository branch (not main) that has an active Pull Request needing feedback implementation.
---

# PR Research

## Overview
This skill automates the process of reviewing open Pull Request comments for the current Git branch, implementing the requested changes, validating the codebase, and preparing responses to the reviewers.

## Prerequisites & Constraints
- Must be executed within a Git repository.
- The current branch MUST NOT be `main` or `master`.
- The GitHub CLI (`gh`) must be installed and authenticated.

## Workflow

When triggered, strictly follow these steps in order:

### 1. Pre-flight Checks
- Verify the workspace is a Git repository (`git rev-parse --is-inside-work-tree`).
- Determine the current branch (`git branch --show-current`).
- If the branch is `main` or `master`, **HALT immediately**. Inform the user that this skill should only be run on feature branches with open PRs.

### 2. Fetch PR Information
- Use the GitHub CLI to fetch the PR associated with the current branch and its open comments.
  - Useful commands: `gh pr view --json url,title,state,comments,reviews` or `gh api` to fetch threads.
- If no PR is found, or if `gh` is not installed/authenticated, ask the user for guidance or to provide the PR details manually.

### 3. Analyze and Implement
- Carefully read through all unresolved comments and review threads.
- Formulate an implementation plan to address each piece of feedback.
- Use your file editing tools (`replace`, `write_file`, etc.) to implement the necessary code changes.

### 4. Validate Codebase
Once changes are implemented, you MUST validate them.
- Identify the project's testing, linting, formatting, and coverage commands (e.g., by checking `package.json`, `Makefile`, `tox.ini`, `Cargo.toml`, etc.).
- Execute the following checks:
  1. Formatting passes.
  2. Linting passes.
  3. All unit tests pass.
  4. Test coverage is maintained or improved.
- If any check fails, iteratively fix the issue until all validations pass.

### 5. User Review
- **STOP and ask the user for approval.**
- Provide a clear, organized summary of:
  - The comments addressed.
  - The files modified.
  - The validation results (tests, lint, coverage).
- Do not proceed to pushing or commenting until the user explicitly agrees with the changes.

### 6. Push Changes
- Once the user approves, stage and commit the changes (with a descriptive commit message).
- Push the changes to the remote branch (`git push`).

### 7. Respond to Comments
- Go through each open comment/discussion that was addressed.
- Use the GitHub CLI (e.g., `gh pr review`, `gh api`) to respond to each comment one at a time, explaining how it was resolved.
- If the feedback was provided as one large block/summary review rather than inline comments, post a single summary response at the main level of the PR explaining the changes made.
