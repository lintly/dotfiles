#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Helper to parse a GitHub PR URL.
 * Supports:
 * - https://github.com/owner/repo/pull/num
 * - github.com/owner/repo/pull/num
 * - owner/repo/pull/num
 */
function parsePrUrl(url) {
  const regex = /(?:github\.com\/)?([^\/]+)\/([^\/]+)\/pull\/(\d+)/i;
  const match = url.match(regex);
  if (!match) {
    throw new Error(`Invalid GitHub PR URL format: ${url}`);
  }
  return {
    owner: match[1],
    repo: match[2],
    prNumber: parseInt(match[3], 10)
  };
}

/**
 * Execute a command and return stdout as string.
 */
function runCommand(command, stdinData = null) {
  try {
    const options = { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 };
    if (stdinData !== null) {
      options.input = stdinData;
    }
    return execSync(command, options);
  } catch (error) {
    throw new Error(`Command failed: ${command}\nError: ${error.message}\nStderr: ${error.stderr}`);
  }
}

/**
 * Run git command and return output or null on failure.
 */
function runGit(args) {
  try {
    const newArgs = [...args];
    if (newArgs[0] === 'diff') {
      newArgs.splice(1, 0, '--no-ext-diff');
    }
    const result = execSync(`git ${newArgs.join(' ')}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    return result.trim();
  } catch (e) {
    return null;
  }
}

/**
 * Find standard main branch name (main or master)
 */
function getDefaultBaseBranch() {
  let originHead = runGit(['symbolic-ref', 'refs/remotes/origin/HEAD']);
  if (originHead) {
    const parts = originHead.split('/');
    return parts[parts.length - 1];
  }
  
  if (runGit(['rev-parse', '--verify', 'main'])) {
    return 'main';
  }
  if (runGit(['rev-parse', '--verify', 'master'])) {
    return 'master';
  }
  if (runGit(['rev-parse', '--verify', 'origin/main'])) {
    return 'origin/main';
  }
  if (runGit(['rev-parse', '--verify', 'origin/master'])) {
    return 'origin/master';
  }
  return 'main';
}

/**
 * Reads file contents and structures them as virtual diff (for untracked or clean files)
 */
function getFilesAsDiff(filesList) {
  let output = '';
  for (const file of filesList) {
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        output += `diff --git a/${file} b/${file}\n`;
        output += `new file mode 100644\n`;
        output += `--- /dev/null\n`;
        output += `+++ b/${file}\n`;
        const lines = content.split('\n');
        output += `@@ -0,0 +1,${lines.length} @@\n`;
        output += lines.map(line => `+${line}`).join('\n') + '\n';
      } catch (e) {
        output += `Error reading file ${file}: ${e.message}\n`;
      }
    } else {
      output += `Error: File not found or is not a file: ${file}\n`;
    }
  }
  return output;
}

/**
 * Fallback for non-git repository review of specific files
 */
function fetchLocalNonGit(filesList) {
  const diff = getFilesAsDiff(filesList);
  return {
    owner: 'local',
    repo: 'non-git-repo',
    prNumber: null,
    currentUser: null,
    alreadyReviewed: false,
    reviewComments: [],
    metadata: {
      title: 'Local Review: Non-Git Specific Files',
      body: `Reviewing files outside git repository: ${filesList.join(', ')}`,
      author: { login: 'local' },
      state: 'LOCAL',
      baseRefName: 'none',
      headRefName: 'none',
      headRefOid: 'none',
      comments: [],
      reviews: []
    },
    diff: diff
  };
}

/**
 * Fetch local branch/working copy changes and metadata.
 */
function fetchLocal(mode = 'default', targetBranch = null, filesList = []) {
  const isGit = runGit(['rev-parse', '--is-inside-work-tree']) === 'true';
  if (!isGit) {
    if (filesList.length > 0) {
      console.error("Non-Git repository. Reviewing specific files...");
      return fetchLocalNonGit(filesList);
    } else {
      throw new Error("Not inside a git repository and no files specified for review.");
    }
  }

  const currentBranch = runGit(['branch', '--show-current']) || 'HEAD';
  const baseBranch = targetBranch || getDefaultBaseBranch();
  const topLevel = runGit(['rev-parse', '--show-toplevel']);
  const repoName = topLevel ? path.basename(topLevel) : 'local-repo';
  const authorName = runGit(['config', 'user.name']) || 'local';
  const headSha = runGit(['rev-parse', 'HEAD']) || 'local';

  let diff = '';
  let title = `Local Review: ${currentBranch}`;
  let body = `Reviewing local changes on branch ${currentBranch}`;

  if (mode === 'files' && filesList.length > 0) {
    title = `Local Review: Specific Files`;
    body = `Reviewing files: ${filesList.join(', ')}`;
    console.error(`Local Review: Diffing specific files: ${filesList.join(', ')}...`);
    diff = runGit(['diff', 'HEAD', '--', ...filesList]) || '';
    if (!diff.trim()) {
      console.error(`No differences found. Falling back to reading full file contents...`);
      diff = getFilesAsDiff(filesList);
    }
  } else if (mode === 'staged') {
    title = `Local Review: Staged Changes`;
    body = `Reviewing staged git changes on branch ${currentBranch}`;
    console.error(`Local Review: Diffing STAGED changes...`);
    diff = runGit(['diff', '--cached']) || '';
  } else if (mode === 'branch') {
    title = `Local Review: Branch Changes`;
    body = `Reviewing branch changes on ${currentBranch} compared to ${baseBranch}`;
    const mergeBase = runGit(['merge-base', baseBranch, 'HEAD']) || baseBranch;
    console.error(`Local Review: Diffing branch against merge-base ${mergeBase} (from ${baseBranch})...`);
    diff = runGit(['diff', mergeBase, 'HEAD']) || '';
  } else {
    // Default mode: Check staged + unstaged changes
    console.error(`Local Review: Diffing unstaged and staged changes...`);
    diff = runGit(['diff', 'HEAD']) || '';
    if (!diff.trim()) {
      // Fallback: compare current branch against base branch
      console.error(`No uncommitted changes found. Falling back to branch review against ${baseBranch}...`);
      const mergeBase = runGit(['merge-base', baseBranch, 'HEAD']) || baseBranch;
      diff = runGit(['diff', mergeBase, 'HEAD']) || '';
      body = `Reviewing branch changes on ${currentBranch} compared to ${baseBranch}`;
    } else {
      body = `Reviewing uncommitted changes (staged and unstaged) on branch ${currentBranch}`;
    }
  }

  return {
    owner: 'local',
    repo: repoName,
    prNumber: null,
    currentUser: null,
    alreadyReviewed: false,
    reviewComments: [],
    metadata: {
      title,
      body,
      author: { login: authorName },
      state: 'LOCAL',
      baseRefName: baseBranch,
      headRefName: currentBranch,
      headRefOid: headSha,
      comments: [],
      reviews: []
    },
    diff: diff
  };
}

/**
 * Fetch PR details and diff.
 */
function fetchPr(url) {
  const { owner, repo, prNumber } = parsePrUrl(url);
  const repoFlag = `-R ${owner}/${repo}`;

  console.error(`Fetching metadata for PR #${prNumber} in ${owner}/${repo}...`);
  const metaJson = runCommand(`gh pr view ${prNumber} ${repoFlag} --json title,body,author,state,baseRefName,headRefName,headRefOid,comments,reviews`);
  const metadata = JSON.parse(metaJson);

  let currentUser = null;
  try {
    const userJson = runCommand(`gh api user`);
    currentUser = JSON.parse(userJson).login;
  } catch (e) {
    console.error(`Failed to fetch authenticated user: ${e.message}`);
  }

  console.error(`Fetching review comments for PR #${prNumber}...`);
  let reviewComments = [];
  try {
    const commentsJson = runCommand(`gh api repos/${owner}/${repo}/pulls/${prNumber}/comments`);
    reviewComments = JSON.parse(commentsJson);
  } catch (e) {
    console.error(`Failed to fetch review comments: ${e.message}`);
  }

  console.error(`Fetching review threads (resolved status) for PR #${prNumber}...`);
  let reviewThreads = [];
  try {
    const query = `query($owner: String!, $repo: String!, $pr: Int!) { repository(owner: $owner, name: $repo) { pullRequest(number: $pr) { reviewThreads(last: 100) { nodes { id isResolved line originalLine path comments(last: 100) { nodes { id body path line state author { login } } } } } } } }`;
    const threadsJson = runCommand(`gh api graphql -F owner="${owner}" -F repo="${repo}" -F pr=${prNumber} -f query='${query}'`);
    const threadsData = JSON.parse(threadsJson);
    if (threadsData && threadsData.data && threadsData.data.repository && threadsData.data.repository.pullRequest) {
      reviewThreads = threadsData.data.repository.pullRequest.reviewThreads.nodes || [];
    }
  } catch (e) {
    console.error(`Failed to fetch review threads: ${e.message}`);
  }
  metadata.reviewThreads = reviewThreads;

  let alreadyReviewed = false;
  if (currentUser) {
    if (Array.isArray(metadata.reviews)) {
      alreadyReviewed = metadata.reviews.some(r => 
        r.author && 
        r.author.login === currentUser && 
        r.commit && 
        r.commit.oid === metadata.headRefOid
      );
    }
    if (!alreadyReviewed && Array.isArray(reviewComments)) {
      alreadyReviewed = reviewComments.some(c => 
        c.user && 
        c.user.login === currentUser && 
        (c.commit_id === metadata.headRefOid || c.original_commit_id === metadata.headRefOid)
      );
    }
  }

  console.error(`Fetching diff for PR #${prNumber}...`);
  let diff;
  try {
    diff = runCommand(`gh pr diff ${prNumber} ${repoFlag} --color=never --allow-escape-sequences`);
  } catch (error) {
    console.error(`gh pr diff failed: ${error.message.split('\n')[0]}. Trying local git diff fallback...`);
    try {
      console.error(`Fetching head ref pull/${prNumber}/head from git...`);
      execSync(`git fetch origin pull/${prNumber}/head`, { stdio: 'ignore' });
    } catch (e) {
      console.error(`Local git fetch failed: ${e.message}`);
    }
    try {
      const baseRef = metadata.baseRefName;
      const headOid = metadata.headRefOid;
      console.error(`Running git diff origin/${baseRef}...${headOid}`);
      diff = execSync(`git diff --no-ext-diff origin/${baseRef}...${headOid}`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    } catch (diffError) {
      throw new Error(`Both gh pr diff and local git diff fallback failed.\ngh error: ${error.message}\ngit error: ${diffError.message}`);
    }
  }

  return {
    owner,
    repo,
    prNumber,
    currentUser,
    alreadyReviewed,
    reviewComments,
    reviewThreads,
    metadata,
    diff
  };
}

/**
 * Submit PR Review.
 */
function submitReview(url, reviewData) {
  const { owner, repo, prNumber } = parsePrUrl(url);
  const repoFlag = `-R ${owner}/${repo}`;

  // reviewData should contain:
  // - event: "APPROVE", "REQUEST_CHANGES", "COMMENT"
  // - body: overall review summary
  // - comments: Array of { path, line, body }
  // Optional: commit_id (defaults to HEAD commit SHA of PR)

  if (!reviewData.event) {
    throw new Error("Missing 'event' in review data (APPROVE, REQUEST_CHANGES, or COMMENT)");
  }

  const payload = {
    event: reviewData.event,
    body: reviewData.body || ""
  };

  if (reviewData.commit_id) {
    payload.commit_id = reviewData.commit_id;
  }

  let existingComments = [];
  try {
    const commentsJson = runCommand(`gh api repos/${owner}/${repo}/pulls/${prNumber}/comments`);
    existingComments = JSON.parse(commentsJson);
  } catch (e) {
    console.error(`Warning: Failed to fetch existing comments for duplicate check: ${e.message}`);
  }

  let commentsToPost = [];
  if (Array.isArray(reviewData.comments) && reviewData.comments.length > 0) {
    // 1. Filter out comments that already exist on GitHub
    commentsToPost = reviewData.comments.filter(c => {
      if (!c.path || !c.line || !c.body) {
        throw new Error("Each inline comment must contain 'path', 'line', and 'body'");
      }

      // Normalize bodies and check duplicates
      const norm = (str) => (str || '').toLowerCase().replace(/\s+/g, '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      const newNorm = norm(c.body);

      const isDup = existingComments.some(ext => {
        if (ext.path !== c.path || parseInt(ext.line, 10) !== parseInt(c.line, 10)) {
          return false;
        }
        const extNorm = norm(ext.body);
        return extNorm.includes(newNorm) || newNorm.includes(extNorm);
      });

      if (isDup) {
        console.error(`Skipping duplicate comment on ${c.path}:${c.line} (already posted).`);
        return false;
      }
      return true;
    });

    // 2. Filter out internal duplicate comments in the review payload itself
    const seen = new Set();
    commentsToPost = commentsToPost.filter(c => {
      const key = `${c.path}:${c.line}:${c.body.trim()}`;
      if (seen.has(key)) {
        console.error(`Skipping internally duplicated comment on ${c.path}:${c.line}.`);
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  if (commentsToPost.length > 0) {
    payload.comments = commentsToPost.map(c => {
      return {
        path: c.path,
        line: parseInt(c.line, 10),
        body: c.body,
        side: c.side || "RIGHT" // RIGHT is default for added/modified lines in PRs
      };
    });
  }

  if ((!payload.body || !payload.body.trim()) && (!payload.comments || payload.comments.length === 0)) {
    console.error("No new comments or review body to submit. All proposed comments were identified as duplicates.");
    return { skippedAll: true, message: "No new comments to submit (all were duplicates)." };
  }

  console.error(`Submitting review with event ${payload.event} and ${payload.comments ? payload.comments.length : 0} inline comments to PR #${prNumber}...`);
  
  const apiPath = `repos/${owner}/${repo}/pulls/${prNumber}/reviews`;
  const result = runCommand(`gh api ${apiPath} --method POST --input -`, JSON.stringify(payload));
  
  return JSON.parse(result);
}

function main() {
  const args = process.argv.slice(2);
  const action = args[0];

  if (!action || (action !== 'fetch' && action !== 'submit')) {
    console.error("Usage:\n  node pr_helper.cjs fetch [pr-url | options]\n  node pr_helper.cjs submit <pr-url> <path-to-review-json>");
    process.exit(1);
  }

  try {
    if (action === 'fetch') {
      const firstArgRaw = args[1];
      const firstArg = firstArgRaw ? firstArgRaw.trim() : '';
      
      const isOption = (arg) => arg.startsWith('--');
      const isPrUrl = (arg) => arg.includes('github.com') || (arg && !arg.startsWith('--') && arg.split('/').length >= 3 && /\d+$/.test(arg));

      if (firstArg && isPrUrl(firstArg)) {
        // GitHub PR Mode
        const data = fetchPr(firstArg);
        console.log(JSON.stringify(data, null, 2));
      } else {
        // Local Mode - Parse options
        let mode = 'default';
        let targetBranch = null;
        const filesList = [];
        
        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          if (arg === '--staged') {
            mode = 'staged';
          } else if (arg === '--branch') {
            mode = 'branch';
            if (args[i + 1] && !args[i + 1].startsWith('--')) {
              targetBranch = args[i + 1];
              i++;
            }
          } else if (arg === '--files') {
            mode = 'files';
            for (let j = i + 1; j < args.length; j++) {
              if (args[j].startsWith('--')) {
                i = j - 1;
                break;
              }
              filesList.push(args[j]);
              i = j;
            }
          } else if (!arg.startsWith('--')) {
            filesList.push(arg);
            if (mode === 'default') mode = 'files';
          }
        }
        
        const data = fetchLocal(mode, targetBranch, filesList);
        console.log(JSON.stringify(data, null, 2));
      }
    } else if (action === 'submit') {
      const url = args[1];
      const jsonPath = args[2];
      if (!url || !jsonPath) {
        console.error("Error: Missing PR URL or JSON path");
        process.exit(1);
      }
      if (!fs.existsSync(jsonPath)) {
        console.error(`Error: File does not exist at ${jsonPath}`);
        process.exit(1);
      }
      const reviewData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const response = submitReview(url, reviewData);
      console.log(JSON.stringify({ success: true, response }, null, 2));
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
