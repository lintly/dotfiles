#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync, execSync } = require('child_process');

// Helper to check if a command is available on system PATH
function hasCommand(cmd) {
  try {
    const checkCmd = process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`;
    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

// Helper to run commands and capture output cleanly without throwing
function runCommand(cmd, args, dir = process.cwd()) {
  const result = spawnSync(cmd, args, {
    cwd: dir,
    encoding: 'utf-8',
    shell: true
  });

  return {
    success: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    code: result.status
  };
}

// Group files by language extension
function groupFilesByLanguage(files) {
  const groups = {
    javascript: [],
    python: [],
    go: [],
    rust: []
  };

  const jsExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json'];
  
  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (jsExtensions.includes(ext)) {
      groups.javascript.push(file);
    } else if (ext === '.py') {
      groups.python.push(file);
    } else if (ext === '.go') {
      groups.go.push(file);
    } else if (ext === '.rs') {
      groups.rust.push(file);
    }
  });

  return groups;
}

// Main execution function
function main() {
  const args = process.argv.slice(2);
  let isFix = false;
  let filesToCheck = [];

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--fix') {
      isFix = true;
    } else if (args[i] === '--files') {
      // Gather all remaining or non-flag arguments as files
      for (let j = i + 1; j < args.length; j++) {
        if (args[j].startsWith('--')) {
          i = j - 1;
          break;
        }
        filesToCheck.push(args[j]);
        i = j;
      }
    } else if (!args[i].startsWith('--')) {
      filesToCheck.push(args[i]);
    }
  }

  // If specific files are given, filter and group them
  const hasSpecificFiles = filesToCheck.length > 0;
  const groups = hasSpecificFiles ? groupFilesByLanguage(filesToCheck) : null;

  const results = [];
  let detectedProjects = [];

  // 1. JavaScript & TypeScript Detection and Linting
  const hasPackageJson = fs.existsSync(path.join(process.cwd(), 'package.json'));
  const hasJSFiles = hasSpecificFiles ? groups.javascript.length > 0 : fs.readdirSync(process.cwd()).some(f => f.match(/\.(js|jsx|ts|tsx)$/));

  if (hasPackageJson || (hasSpecificFiles && groups.javascript.length > 0)) {
    detectedProjects.push('JavaScript/TypeScript');
    const targetFiles = hasSpecificFiles ? groups.javascript : [];
    
    // Check if ESLint is available locally or globally
    const useLocalEslint = fs.existsSync(path.join(process.cwd(), 'node_modules', '.bin', 'eslint'));
    const eslintCmd = useLocalEslint ? path.join('node_modules', '.bin', 'eslint') : 'npx eslint';

    // We only run ESLint if eslint config exists or eslint package is in package.json
    let eslintConfigExists = false;
    const eslintConfigs = ['.eslintrc', '.eslintrc.json', '.eslintrc.js', '.eslintrc.yml', '.eslintrc.yaml', 'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs'];
    for (const config of eslintConfigs) {
      if (fs.existsSync(path.join(process.cwd(), config))) {
        eslintConfigExists = true;
        break;
      }
    }
    
    if (hasPackageJson && !eslintConfigExists) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
        if (pkg.devDependencies?.eslint || pkg.dependencies?.eslint) {
          eslintConfigExists = true;
        }
      } catch (e) {}
    }

    if (eslintConfigExists || hasCommand('eslint')) {
      const eslintArgs = [];
      if (isFix) eslintArgs.push('--fix');
      
      if (hasSpecificFiles) {
        if (targetFiles.length > 0) {
          eslintArgs.push(...targetFiles);
          results.push({
            tool: 'ESLint',
            ...runCommand(eslintCmd, eslintArgs)
          });
        }
      } else {
        eslintArgs.push('.');
        results.push({
          tool: 'ESLint',
          ...runCommand(eslintCmd, eslintArgs)
        });
      }
    }

    // Check Prettier
    const useLocalPrettier = fs.existsSync(path.join(process.cwd(), 'node_modules', '.bin', 'prettier'));
    const prettierCmd = useLocalPrettier ? path.join('node_modules', '.bin', 'prettier') : 'npx prettier';
    
    let prettierConfigExists = false;
    const prettierConfigs = ['.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.yml', '.prettierrc.yaml', 'prettier.config.js'];
    for (const config of prettierConfigs) {
      if (fs.existsSync(path.join(process.cwd(), config))) {
        prettierConfigExists = true;
        break;
      }
    }

    if (hasPackageJson && !prettierConfigExists) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
        if (pkg.devDependencies?.prettier || pkg.dependencies?.prettier) {
          prettierConfigExists = true;
        }
      } catch (e) {}
    }

    if (prettierConfigExists || hasCommand('prettier')) {
      const prettierArgs = [];
      if (isFix) {
        prettierArgs.push('--write');
      } else {
        prettierArgs.push('--check');
      }

      if (hasSpecificFiles) {
        if (targetFiles.length > 0) {
          prettierArgs.push(...targetFiles);
          results.push({
            tool: 'Prettier',
            ...runCommand(prettierCmd, prettierArgs)
          });
        }
      } else {
        prettierArgs.push('.');
        results.push({
          tool: 'Prettier',
          ...runCommand(prettierCmd, prettierArgs)
        });
      }
    }
  }

  // 2. Python Detection and Linting
  const hasPythonFiles = hasSpecificFiles ? groups.python.length > 0 : fs.readdirSync(process.cwd()).some(f => f.endsWith('.py') || f === 'pyproject.toml' || f === 'requirements.txt');
  if (hasPythonFiles) {
    detectedProjects.push('Python');
    const targetFiles = hasSpecificFiles ? groups.python : [];

    if (hasCommand('ruff')) {
      // Ruff Check
      const ruffCheckArgs = ['check'];
      if (isFix) ruffCheckArgs.push('--fix');
      if (hasSpecificFiles) {
        if (targetFiles.length > 0) {
          ruffCheckArgs.push(...targetFiles);
          results.push({ tool: 'Ruff Check', ...runCommand('ruff', ruffCheckArgs) });
        }
      } else {
        ruffCheckArgs.push('.');
        results.push({ tool: 'Ruff Check', ...runCommand('ruff', ruffCheckArgs) });
      }

      // Ruff Format
      const ruffFormatArgs = ['format'];
      if (!isFix) ruffFormatArgs.push('--check');
      if (hasSpecificFiles) {
        if (targetFiles.length > 0) {
          ruffFormatArgs.push(...targetFiles);
          results.push({ tool: 'Ruff Format', ...runCommand('ruff', ruffFormatArgs) });
        }
      } else {
        ruffFormatArgs.push('.');
        results.push({ tool: 'Ruff Format', ...runCommand('ruff', ruffFormatArgs) });
      }
    } else {
      // Fallback to Black/Flake8/Isort
      if (hasCommand('black')) {
        const blackArgs = [];
        if (!isFix) blackArgs.push('--check');
        if (hasSpecificFiles) {
          if (targetFiles.length > 0) {
            blackArgs.push(...targetFiles);
            results.push({ tool: 'Black', ...runCommand('black', blackArgs) });
          }
        } else {
          blackArgs.push('.');
          results.push({ tool: 'Black', ...runCommand('black', blackArgs) });
        }
      }

      if (hasCommand('isort')) {
        const isortArgs = [];
        if (!isFix) isortArgs.push('--check');
        if (hasSpecificFiles) {
          if (targetFiles.length > 0) {
            isortArgs.push(...targetFiles);
            results.push({ tool: 'Isort', ...runCommand('isort', isortArgs) });
          }
        } else {
          isortArgs.push('.');
          results.push({ tool: 'Isort', ...runCommand('isort', isortArgs) });
        }
      }

      if (hasCommand('flake8')) {
        const flakeArgs = [];
        if (hasSpecificFiles) {
          if (targetFiles.length > 0) {
            flakeArgs.push(...targetFiles);
            results.push({ tool: 'Flake8', ...runCommand('flake8', flakeArgs) });
          }
        } else {
          flakeArgs.push('.');
          results.push({ tool: 'Flake8', ...runCommand('flake8', flakeArgs) });
        }
      }
    }
  }

  // 3. Go Detection and Linting
  const hasGoMod = fs.existsSync(path.join(process.cwd(), 'go.mod'));
  const hasGoFiles = hasSpecificFiles ? groups.go.length > 0 : fs.readdirSync(process.cwd()).some(f => f.endsWith('.go'));

  if (hasGoMod || hasGoFiles) {
    detectedProjects.push('Go');
    const targetFiles = hasSpecificFiles ? groups.go : [];

    if (hasCommand('gofmt')) {
      const gofmtArgs = [];
      if (isFix) {
        gofmtArgs.push('-w');
      } else {
        gofmtArgs.push('-d');
      }
      
      if (hasSpecificFiles) {
        if (targetFiles.length > 0) {
          gofmtArgs.push(...targetFiles);
          results.push({ tool: 'gofmt', ...runCommand('gofmt', gofmtArgs) });
        }
      } else {
        gofmtArgs.push('.');
        results.push({ tool: 'gofmt', ...runCommand('gofmt', gofmtArgs) });
      }
    }

    if (hasCommand('golangci-lint')) {
      // golangci-lint typically runs on project level, but can run on specific folder/files
      const lintArgs = ['run'];
      if (isFix) lintArgs.push('--fix');
      
      if (hasSpecificFiles && targetFiles.length > 0) {
        // golangci-lint usually takes directory or packages
        const dirs = [...new Set(targetFiles.map(f => path.dirname(f)))];
        lintArgs.push(...dirs);
      }
      results.push({ tool: 'golangci-lint', ...runCommand('golangci-lint', lintArgs) });
    }
  }

  // 4. Rust Detection and Linting
  const hasCargoToml = fs.existsSync(path.join(process.cwd(), 'Cargo.toml'));
  const hasRustFiles = hasSpecificFiles ? groups.rust.length > 0 : fs.readdirSync(process.cwd()).some(f => f.endsWith('.rs'));

  if (hasCargoToml || hasRustFiles) {
    detectedProjects.push('Rust');
    
    if (hasCommand('cargo')) {
      // cargo fmt
      const fmtArgs = ['fmt'];
      if (!isFix) {
        fmtArgs.push('--', '--check');
      }
      results.push({ tool: 'cargo fmt', ...runCommand('cargo', fmtArgs) });

      // cargo clippy (only if Cargo.toml is available)
      if (hasCargoToml) {
        const clippyArgs = ['clippy', '--', '-D', 'warnings'];
        results.push({ tool: 'cargo clippy', ...runCommand('cargo', clippyArgs) });
      }
    }
  }

  // Generate clean output
  if (detectedProjects.length === 0) {
    process.stdout.write("Failure: No supported project files (JS/TS, Python, Go, Rust) detected in this directory.\n");
    process.exit(0);
  }

  process.stdout.write(`\nDetected ${detectedProjects.join(', ')} project context(s).\n`);
  process.stdout.write(`Mode: ${isFix ? 'Fix/Format' : 'Check Only'}\n`);
  if (hasSpecificFiles) {
    process.stdout.write(`Scoping to specified files: ${filesToCheck.join(', ')}\n`);
  }
  process.stdout.write('--------------------------------------------------\n');

  let overallSuccess = true;
  const passedTools = [];
  const failedTools = [];

  results.forEach(res => {
    if (res.success) {
      passedTools.push(res.tool);
      process.stdout.write(`✅ ${res.tool}: PASSED\n`);
      if (res.stdout.trim()) {
        // limit output display
        const truncatedStdout = res.stdout.split('\n').slice(0, 10).join('\n');
        const outputLines = res.stdout.split('\n');
        process.stdout.write(truncatedStdout + '\n');
        if (outputLines.length > 10) {
          process.stdout.write(`... and ${outputLines.length - 10} more lines of output\n`);
        }
      }
    } else {
      overallSuccess = false;
      failedTools.push(res.tool);
      process.stdout.write(`❌ ${res.tool}: FAILED (Exit Code: ${res.code})\n`);
      
      const errorOutput = res.stderr.trim() || res.stdout.trim() || 'No diagnostic output provided.';
      const truncatedError = errorOutput.split('\n').slice(0, 30).join('\n');
      const errorLines = errorOutput.split('\n');
      process.stdout.write('Error Details:\n' + truncatedError + '\n');
      if (errorLines.length > 30) {
        process.stdout.write(`... and ${errorLines.length - 30} more lines of errors\n`);
      }
    }
    process.stdout.write('--------------------------------------------------\n');
  });

  if (overallSuccess) {
    process.stdout.write(`\nSuccess: All style and validation checks PASSED for: ${passedTools.join(', ')}\n`);
    process.exit(0);
  } else {
    process.stdout.write(`\nFailure: Styling or linting validation failed. Passed: [${passedTools.join(', ')}], Failed: [${failedTools.join(', ')}]\n`);
    process.exit(1);
  }
}

main();
